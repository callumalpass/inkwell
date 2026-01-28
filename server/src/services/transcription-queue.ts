import { readdir, unlink, rename, stat } from "node:fs/promises";
import { config } from "../config.js";
import { updatePage } from "../storage/page-store.js";
import { transcribePage } from "./transcription.js";
import { paths } from "../storage/paths.js";
import { ensureDir, readJson, writeJson } from "../storage/fs-utils.js";
import type { TranscriptionMeta } from "../types/index.js";

export interface TranscriptionJob {
  pageId: string;
  notebookId: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  force: boolean;
}

type JobListener = (
  pageId: string,
  event: "complete" | "failed",
  data: { content?: string; error?: string },
) => void;

let processing = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let listener: JobListener | null = null;
let initialized = false;

/** How many days to keep failed jobs before automatic cleanup */
const FAILED_JOB_RETENTION_DAYS = 7;

export function setTranscriptionListener(fn: JobListener): void {
  listener = fn;
}

async function ensureQueueDirs(): Promise<void> {
  await ensureDir(paths.queuePending());
  await ensureDir(paths.queueFailed());
}

function jobFileName(job: TranscriptionJob): string {
  // Use timestamp + pageId for unique, sortable filename
  const ts = new Date(job.createdAt).getTime();
  return `${ts}_${job.pageId}`;
}

async function writeJob(dir: "pending" | "failed", job: TranscriptionJob): Promise<void> {
  await ensureQueueDirs();
  const filePath = paths.queueJob(dir, jobFileName(job));
  await writeJson(filePath, job);
}

async function findJobFile(dir: "pending" | "failed", pageId: string): Promise<string | null> {
  const dirPath = dir === "pending" ? paths.queuePending() : paths.queueFailed();
  try {
    const files = await readdir(dirPath);
    // Find a file ending with _pageId.json
    const match = files.find(f => f.endsWith(`_${pageId}.json`));
    return match ? `${dirPath}/${match}` : null;
  } catch {
    return null;
  }
}

async function removeJob(dir: "pending" | "failed", job: TranscriptionJob): Promise<void> {
  try {
    // First try exact path based on job data
    const exactPath = paths.queueJob(dir, jobFileName(job));
    try {
      await unlink(exactPath);
      return;
    } catch {
      // If exact path fails, search by pageId
    }

    // Fallback: search for file by pageId
    const foundPath = await findJobFile(dir, job.pageId);
    if (foundPath) {
      await unlink(foundPath);
    }
  } catch (err) {
    // Ignore if file doesn't exist
    if (err instanceof Error && "code" in err && err.code !== "ENOENT") {
      throw err;
    }
  }
}

async function moveJobToFailed(job: TranscriptionJob): Promise<void> {
  await ensureQueueDirs();
  const fileName = jobFileName(job);
  const pendingPath = paths.queueJob("pending", fileName);
  const failedPath = paths.queueJob("failed", fileName);
  try {
    await rename(pendingPath, failedPath);
  } catch (err) {
    // If rename fails (file doesn't exist), write directly to failed
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      await writeJson(failedPath, job);
    } else {
      throw err;
    }
  }
}

async function listPendingJobs(): Promise<TranscriptionJob[]> {
  await ensureQueueDirs();
  const dir = paths.queuePending();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const jobs: TranscriptionJob[] = [];
  for (const file of files.filter(f => f.endsWith(".json")).sort()) {
    const filePath = `${dir}/${file}`;
    const job = await readJson<TranscriptionJob>(filePath);
    if (job) {
      jobs.push(job);
    }
  }
  return jobs;
}

async function getNextPendingJob(): Promise<TranscriptionJob | null> {
  const jobs = await listPendingJobs();
  return jobs[0] ?? null;
}

/**
 * Clean up failed transcription jobs older than FAILED_JOB_RETENTION_DAYS.
 * Returns the number of jobs cleaned up.
 */
export async function cleanupFailedJobs(): Promise<number> {
  await ensureQueueDirs();
  const failedDir = paths.queueFailed();
  let files: string[];
  try {
    files = await readdir(failedDir);
  } catch {
    return 0;
  }

  const now = Date.now();
  const maxAgeMs = FAILED_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let cleaned = 0;

  for (const file of files.filter(f => f.endsWith(".json"))) {
    const filePath = `${failedDir}/${file}`;
    try {
      const fileStat = await stat(filePath);
      const fileAgeMs = now - fileStat.mtime.getTime();

      if (fileAgeMs > maxAgeMs) {
        await unlink(filePath);
        cleaned++;
      }
    } catch {
      // Ignore errors for individual files
    }
  }

  return cleaned;
}

/**
 * List all failed transcription jobs.
 */
export async function listFailedJobs(): Promise<TranscriptionJob[]> {
  await ensureQueueDirs();
  const dir = paths.queueFailed();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const jobs: TranscriptionJob[] = [];
  for (const file of files.filter(f => f.endsWith(".json")).sort()) {
    const filePath = `${dir}/${file}`;
    const job = await readJson<TranscriptionJob>(filePath);
    if (job) {
      jobs.push(job);
    }
  }
  return jobs;
}

/**
 * Retry a failed transcription job by moving it back to the pending queue.
 */
export async function retryFailedJob(pageId: string): Promise<boolean> {
  const jobs = await listFailedJobs();
  const job = jobs.find(j => j.pageId === pageId);
  if (!job) return false;

  // Remove from failed
  await removeJob("failed", job);

  // Reset attempts and re-queue
  job.attempts = 0;
  job.lastError = null;
  job.createdAt = new Date().toISOString();
  await writeJob("pending", job);

  await updatePageTranscriptionStatus(pageId, {
    status: "pending",
    lastAttempt: null,
    error: null,
  });

  if (!processing) {
    processNext();
  }

  return true;
}

export async function initQueue(): Promise<void> {
  if (initialized) return;
  await ensureQueueDirs();
  initialized = true;

  // Run initial cleanup
  await cleanupFailedJobs();

  // Schedule periodic cleanup every 24 hours
  if (!cleanupTimer) {
    cleanupTimer = setInterval(async () => {
      await cleanupFailedJobs();
    }, 24 * 60 * 60 * 1000);
  }

  // Start processing if there are pending jobs
  const pendingJobs = await listPendingJobs();
  if (pendingJobs.length > 0 && !processing) {
    processNext();
  }
}

export async function enqueueTranscription(
  pageId: string,
  notebookId: string,
  force = false,
): Promise<string> {
  await initQueue();

  // Check if job already exists for this page
  const existing = await listPendingJobs();
  const existingJob = existing.find((j) => j.pageId === pageId);

  if (existingJob && !force) {
    return existingJob.pageId;
  }

  if (existingJob && force) {
    await removeJob("pending", existingJob);
  }

  const job: TranscriptionJob = {
    pageId,
    notebookId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    force,
  };

  await writeJob("pending", job);

  await updatePageTranscriptionStatus(pageId, {
    status: "pending",
    lastAttempt: null,
    error: null,
  });

  if (!processing) {
    processNext();
  }

  return job.pageId;
}

export async function getQueueStatus(): Promise<{
  pending: number;
  failed: number;
  jobs: Array<{ pageId: string; attempts: number; status: string; lastError?: string }>;
}> {
  const pendingJobs = await listPendingJobs();
  const failedJobs = await listFailedJobs();
  return {
    pending: pendingJobs.length,
    failed: failedJobs.length,
    jobs: [
      ...pendingJobs.map((j) => ({
        pageId: j.pageId,
        attempts: j.attempts,
        status: j.attempts === 0 ? "pending" : "retrying",
      })),
      ...failedJobs.map((j) => ({
        pageId: j.pageId,
        attempts: j.attempts,
        status: "failed",
        lastError: j.lastError ?? undefined,
      })),
    ],
  };
}

async function updatePageTranscriptionStatus(
  pageId: string,
  transcription: TranscriptionMeta,
): Promise<void> {
  try {
    await updatePage(pageId, { transcription });
  } catch {
    // Best-effort status update — page may have been deleted
  }
}

async function processNext(): Promise<void> {
  const job = await getNextPendingJob();

  if (!job) {
    processing = false;
    return;
  }

  processing = true;

  await updatePageTranscriptionStatus(job.pageId, {
    status: "processing",
    lastAttempt: new Date().toISOString(),
    error: null,
  });

  try {
    const content = await transcribePage(job.pageId);

    await updatePageTranscriptionStatus(job.pageId, {
      status: "complete",
      lastAttempt: new Date().toISOString(),
      error: null,
    });

    await removeJob("pending", job);

    if (listener) {
      listener(job.pageId, "complete", { content });
    }

    // Process next job immediately
    processNext();
  } catch (err) {
    job.attempts++;
    job.lastError = err instanceof Error ? err.message : "Unknown error";
    const now = new Date().toISOString();

    if (job.attempts >= config.transcription.maxRetries) {
      await updatePageTranscriptionStatus(job.pageId, {
        status: "failed",
        lastAttempt: now,
        error: job.lastError,
      });

      await moveJobToFailed(job);

      if (listener) {
        listener(job.pageId, "failed", { error: job.lastError ?? undefined });
      }

      // Process next job immediately
      processNext();
    } else {
      // Exponential backoff: 2^attempts * 1000ms
      const backoffMs = Math.pow(2, job.attempts) * 1000;

      await updatePageTranscriptionStatus(job.pageId, {
        status: "pending",
        lastAttempt: now,
        error: job.lastError,
      });

      // Update the job file with new attempt count
      await writeJob("pending", job);

      pollTimer = setTimeout(() => {
        processNext();
      }, backoffMs);
    }
  }
}

export function stopQueue(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  processing = false;
  listener = null;
  initialized = false;
}

// For testing: expose internal state
export async function _getQueue(): Promise<TranscriptionJob[]> {
  return listPendingJobs();
}

export function _isProcessing(): boolean {
  return processing;
}

// For testing: clear all queue files
export async function _clearQueue(): Promise<void> {
  const jobs = await listPendingJobs();
  for (const job of jobs) {
    await removeJob("pending", job);
  }
}

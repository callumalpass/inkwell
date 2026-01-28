import { config } from "../config.js";
import { updatePage } from "../storage/page-store.js";
import { transcribePage } from "./transcription.js";
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

let queue: TranscriptionJob[] = [];
let processing = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let listener: JobListener | null = null;

export function setTranscriptionListener(fn: JobListener): void {
  listener = fn;
}

export function enqueueTranscription(
  pageId: string,
  notebookId: string,
  force = false,
): string {
  const existing = queue.find((j) => j.pageId === pageId);
  if (existing && !force) {
    return existing.pageId;
  }
  if (existing && force) {
    queue = queue.filter((j) => j.pageId !== pageId);
  }

  const job: TranscriptionJob = {
    pageId,
    notebookId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    force,
  };
  queue.push(job);

  updatePageTranscriptionStatus(pageId, {
    status: "pending",
    lastAttempt: null,
    error: null,
  });

  if (!processing) {
    processNext();
  }

  return job.pageId;
}

export function getQueueStatus(): {
  pending: number;
  jobs: Array<{ pageId: string; attempts: number; status: string }>;
} {
  return {
    pending: queue.length,
    jobs: queue.map((j) => ({
      pageId: j.pageId,
      attempts: j.attempts,
      status: j.attempts === 0 ? "pending" : "retrying",
    })),
  };
}

async function updatePageTranscriptionStatus(
  pageId: string,
  transcription: TranscriptionMeta,
): Promise<void> {
  try {
    await updatePage(pageId, { transcription } as any);
  } catch {
    // Best-effort status update — page may have been deleted
  }
}

async function processNext(): Promise<void> {
  if (queue.length === 0) {
    processing = false;
    return;
  }

  processing = true;
  const job = queue[0];

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

    queue.shift();

    if (listener) {
      listener(job.pageId, "complete", { content });
    }

    // Process next job immediately
    processNext();
  } catch (err: any) {
    job.attempts++;
    job.lastError = err.message || "Unknown error";
    const now = new Date().toISOString();

    if (job.attempts >= config.transcription.maxRetries) {
      await updatePageTranscriptionStatus(job.pageId, {
        status: "failed",
        lastAttempt: now,
        error: job.lastError,
      });

      queue.shift();

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

      // Move to back of queue
      queue.shift();
      queue.push(job);

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
  processing = false;
  queue = [];
  listener = null;
}

// For testing: expose internal queue
export function _getQueue(): TranscriptionJob[] {
  return queue;
}

export function _isProcessing(): boolean {
  return processing;
}

import { apiFetch } from "./client";

export type TranscriptionStatus = "none" | "pending" | "processing" | "complete" | "failed";

export interface TranscriptionInfo {
  status: TranscriptionStatus;
  content: string;
  lastAttempt: string | null;
  error: string | null;
}

export interface TranscribeResponse {
  status: TranscriptionStatus;
  pageId?: string;
  message?: string;
}

export interface BulkTranscribeResponse {
  queued: number;
  total: number;
}

export interface QueueStatus {
  pending: number;
  jobs: Array<{ pageId: string; attempts: number; status: string }>;
}

export function triggerTranscription(pageId: string, force = false) {
  return apiFetch<TranscribeResponse>(`/pages/${pageId}/transcribe`, {
    method: "POST",
    body: JSON.stringify({ force }),
  });
}

export function getTranscription(pageId: string) {
  return apiFetch<TranscriptionInfo>(`/pages/${pageId}/transcription`);
}

export function bulkTranscribe(notebookId: string) {
  return apiFetch<BulkTranscribeResponse>(
    `/notebooks/${notebookId}/transcribe`,
    { method: "POST" },
  );
}

export function getQueueStatus() {
  return apiFetch<QueueStatus>("/transcription/queue");
}

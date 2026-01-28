import { apiFetch } from "./client";
import type { TranscriptionStatus } from "./transcription";

export interface TranscriptionMeta {
  status: TranscriptionStatus;
  lastAttempt: string | null;
  error: string | null;
}

export interface PageMeta {
  id: string;
  notebookId: string;
  pageNumber: number;
  canvasX: number;
  canvasY: number;
  createdAt: string;
  updatedAt: string;
  transcription?: TranscriptionMeta;
}

export function listPages(notebookId: string) {
  return apiFetch<PageMeta[]>(`/notebooks/${notebookId}/pages`);
}

export function createPage(notebookId: string) {
  return apiFetch<PageMeta>(`/notebooks/${notebookId}/pages`, {
    method: "POST",
  });
}

export function getPage(pageId: string) {
  return apiFetch<PageMeta>(`/pages/${pageId}`);
}

export function updatePage(
  pageId: string,
  updates: { canvasX?: number; canvasY?: number; pageNumber?: number },
) {
  return apiFetch<PageMeta>(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deletePage(pageId: string) {
  return apiFetch<void>(`/pages/${pageId}`, { method: "DELETE" });
}

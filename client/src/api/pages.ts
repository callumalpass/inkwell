import { apiFetch } from "./client";
import type { TranscriptionStatus } from "./transcription";

export interface TranscriptionMeta {
  status: TranscriptionStatus;
  lastAttempt: string | null;
  error: string | null;
}

export interface InlineLinkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InlinePageLinkTarget {
  type: "page";
  pageId: string;
  notebookId: string;
  label?: string;
}

export interface InlineUrlLinkTarget {
  type: "url";
  url: string;
  label?: string;
}

export type InlineLinkTarget = InlinePageLinkTarget | InlineUrlLinkTarget;

export interface InlineLink {
  id: string;
  rect: InlineLinkRect;
  target: InlineLinkTarget;
  createdAt: string;
  updatedAt: string;
}

export interface PageMeta {
  id: string;
  notebookId: string;
  pageNumber: number;
  canvasX: number;
  canvasY: number;
  createdAt: string;
  updatedAt: string;
  links?: string[];
  inlineLinks?: InlineLink[];
  tags?: string[];
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
  updates: {
    canvasX?: number;
    canvasY?: number;
    pageNumber?: number;
    links?: string[];
    inlineLinks?: InlineLink[];
    tags?: string[];
  },
) {
  return apiFetch<PageMeta>(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deletePage(pageId: string) {
  return apiFetch<void>(`/pages/${pageId}`, { method: "DELETE" });
}

export function movePages(pageIds: string[], targetNotebookId: string) {
  return apiFetch<void>("/pages/move", {
    method: "POST",
    body: JSON.stringify({ pageIds, targetNotebookId }),
  });
}

export function duplicatePage(pageId: string) {
  return apiFetch<PageMeta>(`/pages/${pageId}/duplicate`, {
    method: "POST",
  });
}

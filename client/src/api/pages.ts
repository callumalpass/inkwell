import { apiFetch } from "./client";

export interface PageMeta {
  id: string;
  notebookId: string;
  pageNumber: number;
  createdAt: string;
  updatedAt: string;
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

export function deletePage(pageId: string) {
  return apiFetch<void>(`/pages/${pageId}`, { method: "DELETE" });
}

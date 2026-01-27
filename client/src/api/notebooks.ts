import { apiFetch } from "./client";

export interface NotebookMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export function listNotebooks() {
  return apiFetch<NotebookMeta[]>("/notebooks");
}

export function getNotebook(id: string) {
  return apiFetch<NotebookMeta>(`/notebooks/${id}`);
}

export function createNotebook(title: string) {
  return apiFetch<NotebookMeta>("/notebooks", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function updateNotebook(id: string, title: string) {
  return apiFetch<NotebookMeta>(`/notebooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function deleteNotebook(id: string) {
  return apiFetch<void>(`/notebooks/${id}`, { method: "DELETE" });
}

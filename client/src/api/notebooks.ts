import { apiFetch } from "./client";

export interface NotebookSettings {
  defaultTool?: "pen" | "highlighter" | "eraser";
  defaultColor?: string;
  defaultStrokeWidth?: number;
  gridType?: "none" | "lined" | "grid" | "dotgrid";
  backgroundLineSpacing?: number;
}

export interface NotebookMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pageCount?: number;
  coverPageId?: string | null;
  settings?: NotebookSettings;
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

export function updateNotebook(
  id: string,
  updates: { title?: string; settings?: NotebookSettings },
) {
  return apiFetch<NotebookMeta>(`/notebooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteNotebook(id: string) {
  return apiFetch<void>(`/notebooks/${id}`, { method: "DELETE" });
}

import { apiFetch } from "./client";
import type { StrokeData } from "../lib/stroke-renderer";

export interface Stroke extends StrokeData {
  createdAt: string;
}

export function getStrokes(pageId: string) {
  return apiFetch<Stroke[]>(`/pages/${pageId}/strokes`);
}

export function postStrokes(pageId: string, strokes: Stroke[]) {
  return apiFetch<{ count: number }>(`/pages/${pageId}/strokes`, {
    method: "POST",
    body: JSON.stringify({ strokes }),
    // Fail fast so offline fallback can queue strokes quickly when connectivity is bad.
    maxRetries: 0,
    timeoutMs: 3000,
  });
}

export function deleteStroke(pageId: string, strokeId: string) {
  return apiFetch<{ count: number }>(`/pages/${pageId}/strokes/${strokeId}`, {
    method: "DELETE",
  });
}

export function clearStrokes(pageId: string) {
  return apiFetch<void>(`/pages/${pageId}/strokes`, { method: "DELETE" });
}

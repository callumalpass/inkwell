import { apiFetch } from "./client";

export interface SearchResult {
  pageId: string;
  notebookId: string;
  notebookName: string;
  excerpt: string;
  modified: string;
  thumbnailUrl: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

export function searchTranscriptions(
  query: string,
  options: { notebook?: string; limit?: number } = {},
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (options.notebook) params.set("notebook", options.notebook);
  if (options.limit) params.set("limit", String(options.limit));
  return apiFetch<SearchResponse>(`/search?${params}`);
}

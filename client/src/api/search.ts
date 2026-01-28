import { apiFetch } from "./client";

export type MatchType = "transcription" | "tag" | "notebook";

export interface SearchResult {
  pageId: string;
  notebookId: string;
  notebookName: string;
  excerpt: string;
  modified: string;
  thumbnailUrl: string;
  tags?: string[];
  matchType: MatchType;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  hasMore: boolean;
}

export interface SearchOptions {
  notebook?: string;
  limit?: number;
  offset?: number;
  matchType?: MatchType[];
}

export function searchTranscriptions(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (options.notebook) params.set("notebook", options.notebook);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  if (options.matchType && options.matchType.length > 0) {
    params.set("matchType", options.matchType.join(","));
  }
  return apiFetch<SearchResponse>(`/search?${params}`);
}

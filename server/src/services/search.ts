import { readFile, readdir } from "node:fs/promises";
import { paths } from "../storage/paths.js";
import { readJson } from "../storage/fs-utils.js";
import type { NotebookMeta, PageMeta } from "../types/index.js";

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

const EXCERPT_CONTEXT_CHARS = 80;

/**
 * Extract a text excerpt around the first match of the query.
 * Returns text with the match highlighted by surrounding `...` context.
 */
function extractExcerpt(content: string, query: string): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerContent.indexOf(lowerQuery);

  if (idx === -1) return content.slice(0, EXCERPT_CONTEXT_CHARS * 2);

  const start = Math.max(0, idx - EXCERPT_CONTEXT_CHARS);
  const end = Math.min(content.length, idx + query.length + EXCERPT_CONTEXT_CHARS);

  let excerpt = content.slice(start, end).replace(/\n+/g, " ").trim();

  if (start > 0) excerpt = "..." + excerpt;
  if (end < content.length) excerpt = excerpt + "...";

  return excerpt;
}

/**
 * Search transcriptions across all notebooks (or a specific notebook).
 * Uses simple case-insensitive substring matching on transcription.md files.
 */
export async function searchTranscriptions(
  query: string,
  options: { notebook?: string; limit?: number } = {},
): Promise<SearchResponse> {
  const limit = options.limit ?? 20;
  const results: SearchResult[] = [];

  const notebooksDir = paths.notebooks();
  let notebookEntries: string[];
  try {
    const entries = await readdir(notebooksDir, { withFileTypes: true });
    notebookEntries = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { results: [], total: 0 };
  }

  // Filter to specific notebook if requested
  if (options.notebook) {
    notebookEntries = notebookEntries.filter((id) => id === options.notebook);
  }

  const lowerQuery = query.toLowerCase();

  for (const notebookId of notebookEntries) {
    const notebookMeta = await readJson<NotebookMeta>(
      paths.notebookMeta(notebookId),
    );
    if (!notebookMeta) continue;

    const pagesDir = paths.pages(notebookId);
    let pageEntries: string[];
    try {
      const entries = await readdir(pagesDir, { withFileTypes: true });
      pageEntries = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      continue;
    }

    for (const pageId of pageEntries) {
      const transcriptionPath = paths.transcription(notebookId, pageId);
      let content: string;
      try {
        content = await readFile(transcriptionPath, "utf-8");
      } catch {
        continue;
      }

      if (!content.toLowerCase().includes(lowerQuery)) continue;

      const pageMeta = await readJson<PageMeta>(
        paths.pageMeta(notebookId, pageId),
      );

      results.push({
        pageId,
        notebookId,
        notebookName: notebookMeta.title,
        excerpt: extractExcerpt(content, query),
        modified: pageMeta?.updatedAt ?? notebookMeta.updatedAt,
        thumbnailUrl: `/api/pages/${pageId}/thumbnail`,
      });
    }
  }

  // Sort by most recently modified first
  results.sort((a, b) => b.modified.localeCompare(a.modified));

  const total = results.length;
  return {
    results: results.slice(0, limit),
    total,
  };
}

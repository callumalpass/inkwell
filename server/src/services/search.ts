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
  tags?: string[];
  matchType: "transcription" | "tag" | "notebook";
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  hasMore: boolean;
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
 * Check if any tag matches the query (case-insensitive).
 */
function matchesTag(tags: string[] | undefined, lowerQuery: string): string | null {
  if (!tags) return null;
  for (const tag of tags) {
    if (tag.toLowerCase().includes(lowerQuery)) {
      return tag;
    }
  }
  return null;
}

export type MatchType = "transcription" | "tag" | "notebook"; // Filter types

/**
 * Search across all notebooks (or a specific notebook).
 * Matches on:
 * - Transcription content (full-text search)
 * - Page tags
 * - Notebook name
 * Uses simple case-insensitive substring matching.
 */
export async function searchTranscriptions(
  query: string,
  options: {
    notebook?: string;
    limit?: number;
    offset?: number;
    matchType?: MatchType[];
  } = {},
): Promise<SearchResponse> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const matchTypeFilter = options.matchType;
  const results: SearchResult[] = [];
  const seenPages = new Set<string>(); // Prevent duplicates if page matches multiple criteria

  const notebooksDir = paths.notebooks();
  let notebookEntries: string[];
  try {
    const entries = await readdir(notebooksDir, { withFileTypes: true });
    notebookEntries = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { results: [], total: 0, hasMore: false };
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

    const notebookNameMatches = notebookMeta.title.toLowerCase().includes(lowerQuery);

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
      if (seenPages.has(pageId)) continue;

      const pageMeta = await readJson<PageMeta>(
        paths.pageMeta(notebookId, pageId),
      );

      // Check for tag match
      const matchedTag = matchesTag(pageMeta?.tags, lowerQuery);

      // Try to read transcription content
      const transcriptionPath = paths.transcription(notebookId, pageId);
      let content: string | null = null;
      try {
        content = await readFile(transcriptionPath, "utf-8");
      } catch {
        // No transcription file - that's ok, we can still match on tags or notebook name
      }

      const transcriptionMatches = content?.toLowerCase().includes(lowerQuery) ?? false;

      // Determine if this page should be included and why
      let matchType: "transcription" | "tag" | "notebook" | null = null;
      let excerpt = "";

      if (transcriptionMatches && content) {
        matchType = "transcription";
        excerpt = extractExcerpt(content, query);
      } else if (matchedTag) {
        matchType = "tag";
        excerpt = `Tagged with "${matchedTag}"`;
      } else if (notebookNameMatches) {
        matchType = "notebook";
        excerpt = content
          ? content.slice(0, EXCERPT_CONTEXT_CHARS * 2).replace(/\n+/g, " ").trim()
          : `Page in "${notebookMeta.title}"`;
        if (content && content.length > EXCERPT_CONTEXT_CHARS * 2) {
          excerpt += "...";
        }
      }

      if (!matchType) continue;

      // Apply matchType filter if specified
      if (matchTypeFilter && matchTypeFilter.length > 0) {
        if (!matchTypeFilter.includes(matchType)) continue;
      }

      seenPages.add(pageId);
      results.push({
        pageId,
        notebookId,
        notebookName: notebookMeta.title,
        excerpt,
        modified: pageMeta?.updatedAt ?? notebookMeta.updatedAt,
        thumbnailUrl: `/api/pages/${pageId}/thumbnail`,
        tags: pageMeta?.tags,
        matchType,
      });
    }
  }

  // Sort by most recently modified first
  results.sort((a, b) => b.modified.localeCompare(a.modified));

  const total = results.length;
  const paginatedResults = results.slice(offset, offset + limit);
  const hasMore = offset + paginatedResults.length < total;

  return {
    results: paginatedResults,
    total,
    hasMore,
  };
}

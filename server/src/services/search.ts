import { readFile, readdir } from "node:fs/promises";
import { paths } from "../storage/paths.js";
import { readJson } from "../storage/fs-utils.js";
import type { NotebookMeta, PageMeta } from "../types/index.js";
import {
  getIndexedPages,
  getIndexedNotebook,
  isIndexInitialized,
  type IndexedPage,
} from "./search-index.js";

export interface SearchResult {
  pageId: string;
  notebookId: string;
  notebookName: string;
  excerpt: string;
  modified: string;
  thumbnailUrl: string;
  tags?: string[];
  matchType: "transcription" | "tag" | "notebook";
  /** Relevance score for ranking (higher is better) */
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  hasMore: boolean;
}

const EXCERPT_CONTEXT_CHARS = 80;

/**
 * Calculate a relevance score for a search result.
 * Higher scores indicate better matches.
 *
 * Factors considered:
 * - Match type priority (transcription > tag > notebook)
 * - Number of matches in content
 * - Exact word match vs partial match
 * - Match position (earlier matches score higher)
 * - Recency (more recent pages score higher)
 */
function calculateRelevanceScore(
  content: string | null,
  query: string,
  matchType: "transcription" | "tag" | "notebook",
  matchedTag: string | null,
  modified: string,
): number {
  let score = 0;
  const lowerQuery = query.toLowerCase();

  // Base score by match type
  switch (matchType) {
    case "transcription":
      score += 100;
      break;
    case "tag":
      score += 80;
      break;
    case "notebook":
      score += 60;
      break;
  }

  // Count occurrences for transcription matches
  if (content && matchType === "transcription") {
    const lowerContent = content.toLowerCase();
    let count = 0;
    let pos = 0;
    while ((pos = lowerContent.indexOf(lowerQuery, pos)) !== -1) {
      count++;
      pos += lowerQuery.length;
    }
    // Each additional occurrence adds points (diminishing returns)
    score += Math.min(count * 10, 50);

    // Bonus for early position in content
    const firstPos = lowerContent.indexOf(lowerQuery);
    if (firstPos !== -1) {
      // First 200 chars get full bonus, then diminishes
      score += Math.max(0, 20 - Math.floor(firstPos / 50));
    }

    // Bonus for exact word match (surrounded by word boundaries)
    const wordBoundaryRegex = new RegExp(
      `\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    if (wordBoundaryRegex.test(content)) {
      score += 30;
    }
  }

  // Tag match bonuses
  if (matchedTag) {
    // Exact tag match gets bonus
    if (matchedTag.toLowerCase() === lowerQuery) {
      score += 40;
    }
  }

  // Recency bonus (pages modified in last 7 days get up to 15 points)
  const modifiedDate = new Date(modified);
  const now = new Date();
  const daysSinceModified = (now.getTime() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceModified < 7) {
    score += Math.floor(15 * (1 - daysSinceModified / 7));
  }

  return score;
}

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
 * Search using the in-memory index (fast path).
 */
function searchWithIndex(
  query: string,
  options: {
    notebook?: string;
    limit?: number;
    offset?: number;
    matchType?: MatchType[];
  } = {},
): SearchResponse {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const matchTypeFilter = options.matchType;
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];
  const seenPages = new Set<string>();

  const pages = getIndexedPages(options.notebook);

  for (const page of pages) {
    if (seenPages.has(page.pageId)) continue;

    const notebookMeta = getIndexedNotebook(page.notebookId);
    const notebookNameMatches = page.notebookName.toLowerCase().includes(lowerQuery);

    // Check for tag match
    const matchedTag = matchesTag(page.tags, lowerQuery);

    // Check transcription match using pre-lowercased content
    const transcriptionMatches = page.contentLower?.includes(lowerQuery) ?? false;

    // Determine if this page should be included and why
    let matchType: "transcription" | "tag" | "notebook" | null = null;
    let excerpt = "";

    if (transcriptionMatches && page.content) {
      matchType = "transcription";
      excerpt = extractExcerpt(page.content, query);
    } else if (matchedTag) {
      matchType = "tag";
      excerpt = `Tagged with "${matchedTag}"`;
    } else if (notebookNameMatches) {
      matchType = "notebook";
      excerpt = page.content
        ? page.content.slice(0, EXCERPT_CONTEXT_CHARS * 2).replace(/\n+/g, " ").trim()
        : `Page in "${page.notebookName}"`;
      if (page.content && page.content.length > EXCERPT_CONTEXT_CHARS * 2) {
        excerpt += "...";
      }
    }

    if (!matchType) continue;

    // Apply matchType filter if specified
    if (matchTypeFilter && matchTypeFilter.length > 0) {
      if (!matchTypeFilter.includes(matchType)) continue;
    }

    const score = calculateRelevanceScore(
      page.content,
      query,
      matchType,
      matchedTag,
      page.modified,
    );

    seenPages.add(page.pageId);
    results.push({
      pageId: page.pageId,
      notebookId: page.notebookId,
      notebookName: page.notebookName,
      excerpt,
      modified: page.modified,
      thumbnailUrl: `/api/pages/${page.pageId}/thumbnail`,
      tags: page.tags.length > 0 ? page.tags : undefined,
      matchType,
      score,
    });
  }

  // Sort by relevance score (highest first), then by modified date as tiebreaker
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.modified.localeCompare(a.modified);
  });

  const total = results.length;
  const paginatedResults = results.slice(offset, offset + limit);
  const hasMore = offset + paginatedResults.length < total;

  return {
    results: paginatedResults,
    total,
    hasMore,
  };
}

/**
 * Search by reading files directly (slow path, fallback).
 */
async function searchFromFiles(
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

      const modifiedDate = pageMeta?.updatedAt ?? notebookMeta.updatedAt;
      const score = calculateRelevanceScore(
        content,
        query,
        matchType,
        matchedTag,
        modifiedDate,
      );

      seenPages.add(pageId);
      results.push({
        pageId,
        notebookId,
        notebookName: notebookMeta.title,
        excerpt,
        modified: modifiedDate,
        thumbnailUrl: `/api/pages/${pageId}/thumbnail`,
        tags: pageMeta?.tags,
        matchType,
        score,
      });
    }
  }

  // Sort by relevance score (highest first), then by modified date as tiebreaker
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.modified.localeCompare(a.modified);
  });

  const total = results.length;
  const paginatedResults = results.slice(offset, offset + limit);
  const hasMore = offset + paginatedResults.length < total;

  return {
    results: paginatedResults,
    total,
    hasMore,
  };
}

/**
 * Search across all notebooks (or a specific notebook).
 * Matches on:
 * - Transcription content (full-text search)
 * - Page tags
 * - Notebook name
 * Uses simple case-insensitive substring matching.
 *
 * Uses the in-memory index when available for fast search,
 * falls back to file-based search if index is not initialized.
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
  // Use index if available
  if (isIndexInitialized()) {
    return searchWithIndex(query, options);
  }

  // Fall back to file-based search
  return searchFromFiles(query, options);
}

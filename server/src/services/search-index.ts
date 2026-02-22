/**
 * Search Index Service
 *
 * Maintains an in-memory index of all transcriptions and page metadata
 * for fast full-text search. The index is built on startup and kept
 * in sync with file changes.
 */

import { readdir, readFile, watch } from "node:fs/promises";
import { paths } from "../storage/paths.js";
import { readJson } from "../storage/fs-utils.js";
import type { NotebookMeta, PageMeta } from "../types/index.js";

export interface IndexedPage {
  pageId: string;
  notebookId: string;
  notebookName: string;
  content: string | null;
  contentLower: string | null;
  tags: string[];
  tagsLower: string[];
  modified: string;
  seq: number;
}

interface SearchIndex {
  pages: Map<string, IndexedPage>;
  notebooks: Map<string, NotebookMeta>;
  initialized: boolean;
}

const index: SearchIndex = {
  pages: new Map(),
  notebooks: new Map(),
  initialized: false,
};

// Watch abort controllers for cleanup
let watchAbortControllers: AbortController[] = [];

/**
 * Build the search index by scanning all notebooks and pages.
 * Called once on server startup.
 */
export async function buildSearchIndex(): Promise<void> {
  if (index.initialized) return;

  const startTime = Date.now();
  index.pages.clear();
  index.notebooks.clear();

  const notebooksDir = paths.notebooks();
  let notebookEntries: string[];

  try {
    const entries = await readdir(notebooksDir, { withFileTypes: true });
    notebookEntries = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    // No notebooks directory yet
    index.initialized = true;
    return;
  }

  for (const notebookId of notebookEntries) {
    await indexNotebook(notebookId);
  }

  index.initialized = true;
  const elapsed = Date.now() - startTime;
  console.log(`Search index built: ${index.pages.size} pages indexed in ${elapsed}ms`);
}

/**
 * Index all pages in a notebook.
 */
async function indexNotebook(notebookId: string): Promise<void> {
  const notebookMeta = await readJson<NotebookMeta>(paths.notebookMeta(notebookId));
  if (!notebookMeta) return;

  index.notebooks.set(notebookId, notebookMeta);

  const pagesDir = paths.pages(notebookId);
  let pageEntries: string[];

  try {
    const entries = await readdir(pagesDir, { withFileTypes: true });
    pageEntries = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return;
  }

  for (const pageId of pageEntries) {
    await indexPage(notebookId, pageId);
  }
}

/**
 * Index a single page.
 */
async function indexPage(notebookId: string, pageId: string): Promise<void> {
  const notebookMeta = index.notebooks.get(notebookId)
    ?? await readJson<NotebookMeta>(paths.notebookMeta(notebookId));
  if (!notebookMeta) return;

  const pageMeta = await readJson<PageMeta>(paths.pageMeta(notebookId, pageId));
  if (!pageMeta) return;

  let content: string | null = null;
  try {
    content = await readFile(paths.transcription(notebookId, pageId), "utf-8");
  } catch {
    // No transcription yet
  }

  const entry: IndexedPage = {
    pageId,
    notebookId,
    notebookName: notebookMeta.title,
    content,
    contentLower: content?.toLowerCase() ?? null,
    tags: pageMeta.tags ?? [],
    tagsLower: (pageMeta.tags ?? []).map(t => t.toLowerCase()),
    modified: pageMeta.updatedAt ?? notebookMeta.updatedAt,
    seq: pageMeta.pageNumber ?? 1,
  };

  index.pages.set(pageId, entry);
}

/**
 * Update the index for a specific page.
 * Called when transcription completes or page metadata changes.
 */
export async function updatePageIndex(pageId: string, notebookId: string): Promise<void> {
  await indexPage(notebookId, pageId);
}

/**
 * Update notebook metadata in the index.
 */
export async function updateNotebookIndex(notebookId: string): Promise<void> {
  const notebookMeta = await readJson<NotebookMeta>(paths.notebookMeta(notebookId));
  if (!notebookMeta) return;

  index.notebooks.set(notebookId, notebookMeta);

  // Update notebook name in all indexed pages
  for (const [pageId, page] of index.pages) {
    if (page.notebookId === notebookId) {
      page.notebookName = notebookMeta.title;
    }
  }
}

/**
 * Remove a page from the index.
 */
export function removePageFromIndex(pageId: string): void {
  index.pages.delete(pageId);
}

/**
 * Remove a notebook and all its pages from the index.
 */
export function removeNotebookFromIndex(notebookId: string): void {
  index.notebooks.delete(notebookId);
  for (const [pageId, page] of index.pages) {
    if (page.notebookId === notebookId) {
      index.pages.delete(pageId);
    }
  }
}

/**
 * Get all indexed pages, optionally filtered by notebook.
 */
export function getIndexedPages(notebookId?: string): IndexedPage[] {
  const pages = Array.from(index.pages.values());
  if (notebookId) {
    return pages.filter(p => p.notebookId === notebookId);
  }
  return pages;
}

/**
 * Get a notebook from the index.
 */
export function getIndexedNotebook(notebookId: string): NotebookMeta | undefined {
  return index.notebooks.get(notebookId);
}

/**
 * Check if the index is initialized.
 */
export function isIndexInitialized(): boolean {
  return index.initialized;
}

/**
 * Get index stats for debugging/monitoring.
 */
export function getIndexStats(): { pages: number; notebooks: number; initialized: boolean } {
  return {
    pages: index.pages.size,
    notebooks: index.notebooks.size,
    initialized: index.initialized,
  };
}

/**
 * Clear the index. Used for testing.
 */
export function clearIndex(): void {
  index.pages.clear();
  index.notebooks.clear();
  index.initialized = false;
}

/**
 * Stop watching for file changes.
 */
export function stopWatching(): void {
  for (const controller of watchAbortControllers) {
    controller.abort();
  }
  watchAbortControllers = [];
}

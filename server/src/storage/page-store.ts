import { readdir, rename, rm, cp } from "node:fs/promises";
import { nanoid } from "nanoid";
import type { PageMeta, PageIndex } from "../types/index.js";
import { paths } from "./paths.js";
import { ensureDir, readJson, writeJson, withLock } from "./fs-utils.js";

async function readPageIndex(): Promise<PageIndex> {
  return (await readJson<PageIndex>(paths.pageIndex())) || {};
}

async function writePageIndex(index: PageIndex): Promise<void> {
  await ensureDir(paths.data());
  await writeJson(paths.pageIndex(), index);
}

export async function listPages(notebookId: string): Promise<PageMeta[]> {
  const dir = paths.pages(notebookId);
  await ensureDir(dir);
  const entries = await readdir(dir, { withFileTypes: true });
  const pages: PageMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = await readJson<PageMeta>(paths.pageMeta(notebookId, entry.name));
    if (meta) pages.push(meta);
  }
  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  return pages;
}

export async function getPage(pageId: string): Promise<PageMeta | null> {
  const index = await readPageIndex();
  const notebookId = index[pageId];
  if (!notebookId) return null;
  return readJson<PageMeta>(paths.pageMeta(notebookId, pageId));
}

export async function getNotebookIdForPage(pageId: string): Promise<string | null> {
  const index = await readPageIndex();
  return index[pageId] || null;
}

export async function createPage(meta: PageMeta): Promise<void> {
  const dir = paths.page(meta.notebookId, meta.id);
  await ensureDir(dir);
  await writeJson(paths.pageMeta(meta.notebookId, meta.id), meta);
  await writeJson(paths.strokes(meta.notebookId, meta.id), []);

  await withLock(paths.data(), async () => {
    const index = await readPageIndex();
    index[meta.id] = meta.notebookId;
    await writePageIndex(index);
  });
}

export async function updatePage(
  pageId: string,
  updates: Partial<Pick<PageMeta, "canvasX" | "canvasY" | "pageNumber" | "links" | "inlineLinks" | "tags" | "transcription">>,
): Promise<PageMeta | null> {
  const index = await readPageIndex();
  const notebookId = index[pageId];
  if (!notebookId) return null;

  const meta = await readJson<PageMeta>(paths.pageMeta(notebookId, pageId));
  if (!meta) return null;

  const updated = { ...meta, ...updates, updatedAt: new Date().toISOString() };
  await writeJson(paths.pageMeta(notebookId, pageId), updated);
  return updated;
}

export async function deletePage(pageId: string): Promise<boolean> {
  return withLock(paths.data(), async () => {
    const index = await readPageIndex();
    const notebookId = index[pageId];
    if (!notebookId) return false;

    await rm(paths.page(notebookId, pageId), { recursive: true, force: true });
    delete index[pageId];
    await writePageIndex(index);
    return true;
  });
}

export async function duplicatePage(pageId: string): Promise<PageMeta | null> {
  return withLock(paths.data(), async () => {
    const index = await readPageIndex();
    const notebookId = index[pageId];
    if (!notebookId) return null;

    const sourceMeta = await readJson<PageMeta>(paths.pageMeta(notebookId, pageId));
    if (!sourceMeta) return null;

    // Get all pages to determine next page number
    const pages = await listPages(notebookId);
    const nextPageNumber = pages.length + 1;

    // Create new page ID
    const newPageId = `pg_${nanoid(12)}`;
    const now = new Date().toISOString();

    // Copy the page directory
    const sourceDir = paths.page(notebookId, pageId);
    const targetDir = paths.page(notebookId, newPageId);
    await cp(sourceDir, targetDir, { recursive: true });

    // Update the metadata with new ID and page number
    const newMeta: PageMeta = {
      ...sourceMeta,
      id: newPageId,
      pageNumber: nextPageNumber,
      createdAt: now,
      updatedAt: now,
      // Reset transcription status since it's a copy
      transcription: undefined,
    };
    await writeJson(paths.pageMeta(notebookId, newPageId), newMeta);

    // Update the page index
    index[newPageId] = notebookId;
    await writePageIndex(index);

    return newMeta;
  });
}

export async function movePages(
  pageIds: string[],
  targetNotebookId: string,
): Promise<PageMeta[]> {
  if (pageIds.length === 0) return [];
  return withLock(paths.data(), async () => {
    const index = await readPageIndex();
    const targetPages = await listPages(targetNotebookId);
    let nextPageNumber = targetPages.length + 1;
    const moved: PageMeta[] = [];

    await ensureDir(paths.pages(targetNotebookId));

    for (const pageId of pageIds) {
      const sourceNotebookId = index[pageId];
      if (!sourceNotebookId) {
        throw new Error(`Page not found: ${pageId}`);
      }
      if (sourceNotebookId === targetNotebookId) {
        throw new Error(`Page already in target notebook: ${pageId}`);
      }

      const meta = await readJson<PageMeta>(paths.pageMeta(sourceNotebookId, pageId));
      if (!meta) {
        throw new Error(`Page metadata missing: ${pageId}`);
      }

      await rename(
        paths.page(sourceNotebookId, pageId),
        paths.page(targetNotebookId, pageId),
      );

      const updated: PageMeta = {
        ...meta,
        notebookId: targetNotebookId,
        pageNumber: nextPageNumber,
        updatedAt: new Date().toISOString(),
      };
      nextPageNumber += 1;
      await writeJson(paths.pageMeta(targetNotebookId, pageId), updated);

      index[pageId] = targetNotebookId;
      moved.push(updated);
    }

    await writePageIndex(index);
    return moved;
  });
}

import { readdir, rm } from "node:fs/promises";
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

  const index = await readPageIndex();
  index[meta.id] = meta.notebookId;
  await writePageIndex(index);
}

export async function updatePage(
  pageId: string,
  updates: Partial<Pick<PageMeta, "canvasX" | "canvasY" | "pageNumber" | "transcription">>,
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
  const index = await readPageIndex();
  const notebookId = index[pageId];
  if (!notebookId) return false;

  await rm(paths.page(notebookId, pageId), { recursive: true, force: true });
  delete index[pageId];
  await writePageIndex(index);
  return true;
}

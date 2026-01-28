import { readdir, rm, cp } from "node:fs/promises";
import { nanoid } from "nanoid";
import type { NotebookMeta, PageIndex } from "../types/index.js";
import { paths } from "./paths.js";
import { ensureDir, readJson, writeJson, withLock } from "./fs-utils.js";

export async function listNotebooks(): Promise<NotebookMeta[]> {
  const dir = paths.notebooks();
  await ensureDir(dir);
  const entries = await readdir(dir, { withFileTypes: true });
  const notebooks: NotebookMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = await readJson<NotebookMeta>(paths.notebookMeta(entry.name));
    if (meta) notebooks.push(meta);
  }
  notebooks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return notebooks;
}

export async function getNotebook(id: string): Promise<NotebookMeta | null> {
  return readJson<NotebookMeta>(paths.notebookMeta(id));
}

export async function createNotebook(meta: NotebookMeta): Promise<void> {
  const dir = paths.notebook(meta.id);
  await ensureDir(dir);
  await ensureDir(paths.pages(meta.id));
  await writeJson(paths.notebookMeta(meta.id), meta);
}

export async function updateNotebook(
  id: string,
  updates: Partial<Pick<NotebookMeta, "title" | "settings">>,
): Promise<NotebookMeta | null> {
  const meta = await getNotebook(id);
  if (!meta) return null;
  const updated = { ...meta, ...updates, updatedAt: new Date().toISOString() };
  await writeJson(paths.notebookMeta(id), updated);
  return updated;
}

export async function deleteNotebook(id: string): Promise<boolean> {
  const meta = await getNotebook(id);
  if (!meta) return false;

  // Collect page IDs before deleting the notebook directory
  const pagesDir = paths.pages(id);
  let pageIds: string[] = [];
  try {
    const entries = await readdir(pagesDir, { withFileTypes: true });
    pageIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    // Pages dir may not exist
  }

  await rm(paths.notebook(id), { recursive: true, force: true });

  // Clean up page-index entries for all pages in this notebook
  if (pageIds.length > 0) {
    await withLock(paths.data(), async () => {
      const index = (await readJson<PageIndex>(paths.pageIndex())) || {};
      for (const pageId of pageIds) {
        delete index[pageId];
      }
      await writeJson(paths.pageIndex(), index);
    });
  }

  return true;
}

export async function duplicateNotebook(id: string): Promise<NotebookMeta | null> {
  const sourceMeta = await getNotebook(id);
  if (!sourceMeta) return null;

  return withLock(paths.data(), async () => {
    const now = new Date().toISOString();
    const newNotebookId = `nb_${nanoid(12)}`;

    // Copy the entire notebook directory
    const sourceDir = paths.notebook(id);
    const targetDir = paths.notebook(newNotebookId);
    await cp(sourceDir, targetDir, { recursive: true });

    // Update notebook metadata
    const newMeta: NotebookMeta = {
      ...sourceMeta,
      id: newNotebookId,
      title: `${sourceMeta.title} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    await writeJson(paths.notebookMeta(newNotebookId), newMeta);

    // Get all page directories in the new notebook and update their metadata + page index
    const pagesDir = paths.pages(newNotebookId);
    const index = (await readJson<PageIndex>(paths.pageIndex())) || {};

    try {
      const entries = await readdir(pagesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const oldPageId = entry.name;
        const newPageId = `pg_${nanoid(12)}`;

        // Rename the page directory
        const { rename } = await import("node:fs/promises");
        await rename(
          paths.page(newNotebookId, oldPageId),
          paths.page(newNotebookId, newPageId),
        );

        // Update page metadata
        const pageMeta = await readJson<import("../types/index.js").PageMeta>(
          paths.pageMeta(newNotebookId, newPageId),
        );
        if (pageMeta) {
          const updatedPageMeta = {
            ...pageMeta,
            id: newPageId,
            notebookId: newNotebookId,
            createdAt: now,
            updatedAt: now,
            // Reset transcription status since it's a copy
            transcription: undefined,
          };
          await writeJson(paths.pageMeta(newNotebookId, newPageId), updatedPageMeta);
        }

        // Add to page index
        index[newPageId] = newNotebookId;
      }
    } catch {
      // Pages dir may not exist if notebook was empty
    }

    await writeJson(paths.pageIndex(), index);

    return newMeta;
  });
}

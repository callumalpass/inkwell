import { readdir, rm } from "node:fs/promises";
import type { NotebookMeta } from "../types/index.js";
import { paths } from "./paths.js";
import { ensureDir, readJson, writeJson } from "./fs-utils.js";

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
  await rm(paths.notebook(id), { recursive: true, force: true });
  return true;
}

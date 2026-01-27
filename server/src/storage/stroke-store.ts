import type { Stroke } from "../types/index.js";
import { paths } from "./paths.js";
import { readJson, writeJson, withLock } from "./fs-utils.js";
import { getNotebookIdForPage } from "./page-store.js";

async function resolveStrokesPath(pageId: string): Promise<string | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;
  return paths.strokes(notebookId, pageId);
}

export async function getStrokes(pageId: string): Promise<Stroke[] | null> {
  const filePath = await resolveStrokesPath(pageId);
  if (!filePath) return null;
  return (await readJson<Stroke[]>(filePath)) || [];
}

export async function appendStrokes(
  pageId: string,
  newStrokes: Stroke[],
): Promise<Stroke[] | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;

  const dir = paths.page(notebookId, pageId);
  const filePath = paths.strokes(notebookId, pageId);

  return withLock(dir, async () => {
    const existing = (await readJson<Stroke[]>(filePath)) || [];
    const updated = [...existing, ...newStrokes];
    await writeJson(filePath, updated);
    return updated;
  });
}

export async function deleteStroke(
  pageId: string,
  strokeId: string,
): Promise<Stroke[] | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;

  const dir = paths.page(notebookId, pageId);
  const filePath = paths.strokes(notebookId, pageId);

  return withLock(dir, async () => {
    const existing = (await readJson<Stroke[]>(filePath)) || [];
    const updated = existing.filter((s) => s.id !== strokeId);
    await writeJson(filePath, updated);
    return updated;
  });
}

export async function clearStrokes(pageId: string): Promise<boolean> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return false;

  const dir = paths.page(notebookId, pageId);
  const filePath = paths.strokes(notebookId, pageId);

  await withLock(dir, async () => {
    await writeJson(filePath, []);
  });
  return true;
}

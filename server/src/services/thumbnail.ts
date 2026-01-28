import { writeFile, unlink, stat } from "node:fs/promises";
import { paths } from "../storage/paths.js";
import { getNotebookIdForPage } from "../storage/page-store.js";
import { getStrokes } from "../storage/stroke-store.js";
import { renderStrokeToCanvas } from "./stroke-rendering.js";
import { createRenderingCanvas, canvasToPngBuffer } from "./canvas-context.js";

// Page dimensions (matching the client's page coordinate system)
const PAGE_WIDTH = 1404;
const PAGE_HEIGHT = 1872;
const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = Math.round(THUMBNAIL_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH));

export async function generateThumbnail(pageId: string): Promise<Buffer | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;

  const strokes = await getStrokes(pageId);
  if (!strokes) return null;

  const { canvas, ctx } = createRenderingCanvas(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  const scaleX = THUMBNAIL_WIDTH / PAGE_WIDTH;
  const scaleY = THUMBNAIL_HEIGHT / PAGE_HEIGHT;

  for (const stroke of strokes) {
    renderStrokeToCanvas(ctx, stroke, scaleX, scaleY);
  }

  return canvasToPngBuffer(canvas);
}

export async function getThumbnailPath(pageId: string): Promise<string | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;
  return paths.thumbnail(notebookId, pageId);
}

export async function getCachedThumbnail(pageId: string): Promise<Buffer | null> {
  const thumbPath = await getThumbnailPath(pageId);
  if (!thumbPath) return null;

  try {
    await stat(thumbPath);
    const { readFile } = await import("node:fs/promises");
    return readFile(thumbPath);
  } catch {
    return null;
  }
}

export async function generateAndCacheThumbnail(pageId: string): Promise<Buffer | null> {
  const buffer = await generateThumbnail(pageId);
  if (!buffer) return null;

  const thumbPath = await getThumbnailPath(pageId);
  if (thumbPath) {
    await writeFile(thumbPath, buffer);
  }

  return buffer;
}

export async function invalidateThumbnail(pageId: string): Promise<void> {
  const thumbPath = await getThumbnailPath(pageId);
  if (!thumbPath) return;

  try {
    await unlink(thumbPath);
  } catch {
    // File doesn't exist, that's fine
  }
}

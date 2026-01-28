import { createCanvas } from "@napi-rs/canvas";
import { writeFile, unlink, stat } from "node:fs/promises";
import getStroke from "perfect-freehand";
import type { Stroke, StrokePoint } from "../types/index.js";
import { paths } from "../storage/paths.js";
import { getNotebookIdForPage } from "../storage/page-store.js";
import { getStrokes } from "../storage/stroke-store.js";

// Page dimensions (matching the client's page coordinate system)
const PAGE_WIDTH = 1404;
const PAGE_HEIGHT = 1872;
const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = Math.round(THUMBNAIL_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH));

type PenStyle = "pressure" | "uniform" | "ballpoint";

function getStrokeOptions(penStyle: PenStyle, width: number) {
  switch (penStyle) {
    case "pressure":
      return {
        size: width,
        smoothing: 0.5,
        thinning: 0.5,
        streamline: 0.5,
        start: { taper: true },
        end: { taper: true },
      };
    case "uniform":
      return {
        size: width,
        smoothing: 0.5,
        thinning: 0,
        streamline: 0.5,
        simulatePressure: false,
        start: { taper: false },
        end: { taper: false },
      };
    case "ballpoint":
      return {
        size: width,
        smoothing: 0.5,
        thinning: 0.15,
        streamline: 0.5,
        simulatePressure: true,
        start: { taper: false },
        end: { taper: 10 },
      };
  }
}

function renderStrokePath(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  scaleX: number,
  scaleY: number,
) {
  const penStyle: PenStyle = stroke.penStyle ?? "pressure";
  const options = getStrokeOptions(penStyle, stroke.width);

  const inputPoints =
    penStyle === "pressure"
      ? stroke.points.map((p: StrokePoint) => [p.x, p.y, p.pressure])
      : stroke.points.map((p: StrokePoint) => [p.x, p.y, 0.5]);

  const outlinePoints = getStroke(inputPoints, options);
  if (outlinePoints.length === 0) return;

  ctx.beginPath();
  ctx.moveTo(outlinePoints[0][0] * scaleX, outlinePoints[0][1] * scaleY);

  for (let i = 1; i < outlinePoints.length - 1; i++) {
    const cp = outlinePoints[i];
    const next = outlinePoints[i + 1];
    const mx = (cp[0] + next[0]) / 2;
    const my = (cp[1] + next[1]) / 2;
    ctx.quadraticCurveTo(
      cp[0] * scaleX,
      cp[1] * scaleY,
      mx * scaleX,
      my * scaleY,
    );
  }

  if (outlinePoints.length > 1) {
    const last = outlinePoints[outlinePoints.length - 1];
    ctx.lineTo(last[0] * scaleX, last[1] * scaleY);
  }

  ctx.closePath();
  ctx.fillStyle = stroke.color || "#000000";
  ctx.fill();
}

export async function generateThumbnail(pageId: string): Promise<Buffer | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;

  const strokes = await getStrokes(pageId);
  if (!strokes) return null;

  const canvas = createCanvas(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  const ctx = canvas.getContext("2d");

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  const scaleX = THUMBNAIL_WIDTH / PAGE_WIDTH;
  const scaleY = THUMBNAIL_HEIGHT / PAGE_HEIGHT;

  for (const stroke of strokes) {
    renderStrokePath(ctx as unknown as CanvasRenderingContext2D, stroke, scaleX, scaleY);
  }

  return canvas.toBuffer("image/png") as unknown as Buffer;
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

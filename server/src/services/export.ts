import PDFDocument from "pdfkit";
import getStroke from "perfect-freehand";
import { createCanvas } from "@napi-rs/canvas";
import type { Stroke, StrokePoint } from "../types/index.js";
import { getStrokes } from "../storage/stroke-store.js";
import { getNotebookIdForPage } from "../storage/page-store.js";
import { getTranscriptionContent } from "./transcription.js";

const PAGE_WIDTH = 1404;
const PAGE_HEIGHT = 1872;

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

/**
 * Convert a stroke to a PDF-compatible SVG path string using Perfect Freehand.
 * Returns the fill color alongside the path data.
 */
function strokeToPath(stroke: Stroke): { path: string; color: string } | null {
  const penStyle: PenStyle = stroke.penStyle ?? "pressure";
  const options = getStrokeOptions(penStyle, stroke.width);

  const inputPoints =
    penStyle === "pressure"
      ? stroke.points.map((p: StrokePoint) => [p.x, p.y, p.pressure])
      : stroke.points.map((p: StrokePoint) => [p.x, p.y, 0.5]);

  const outlinePoints = getStroke(inputPoints, options);
  if (outlinePoints.length === 0) return null;

  // Build SVG path data from outline points
  const parts: string[] = [];
  parts.push(`M ${outlinePoints[0][0]} ${outlinePoints[0][1]}`);

  for (let i = 1; i < outlinePoints.length - 1; i++) {
    const cp = outlinePoints[i];
    const next = outlinePoints[i + 1];
    const mx = (cp[0] + next[0]) / 2;
    const my = (cp[1] + next[1]) / 2;
    parts.push(`Q ${cp[0]} ${cp[1]} ${mx} ${my}`);
  }

  if (outlinePoints.length > 1) {
    const last = outlinePoints[outlinePoints.length - 1];
    parts.push(`L ${last[0]} ${last[1]}`);
  }

  parts.push("Z");

  return { path: parts.join(" "), color: stroke.color || "#000000" };
}

export interface PdfExportOptions {
  includeTranscription?: boolean;
  pageSize?: "original" | "a4" | "letter";
}

interface PageDimensions {
  width: number;
  height: number;
}

function getPageDimensions(pageSize: string): PageDimensions {
  switch (pageSize) {
    case "a4":
      return { width: 595.28, height: 841.89 }; // A4 in PDF points (72 dpi)
    case "letter":
      return { width: 612, height: 792 }; // US Letter in PDF points
    default:
      return { width: PAGE_WIDTH, height: PAGE_HEIGHT };
  }
}

/**
 * Add a page of strokes to a PDF document.
 * Scales strokes from the original coordinate system to the target PDF page size.
 */
function addStrokePageToPdf(
  doc: PDFKit.PDFDocument,
  strokes: Stroke[],
  dims: PageDimensions,
) {
  const scaleX = dims.width / PAGE_WIDTH;
  const scaleY = dims.height / PAGE_HEIGHT;

  for (const stroke of strokes) {
    const result = strokeToPath(stroke);
    if (!result) continue;

    doc.save();
    doc.scale(scaleX, scaleY);
    doc.path(result.path).fill(result.color);
    doc.restore();
  }
}

/**
 * Add a transcription text page to the PDF.
 */
function addTranscriptionPage(
  doc: PDFKit.PDFDocument,
  content: string,
  dims: PageDimensions,
) {
  doc.addPage({ size: [dims.width, dims.height], margin: 50 });
  doc.fontSize(12).font("Helvetica").fillColor("#000000");
  doc.text(content, 50, 50, {
    width: dims.width - 100,
    align: "left",
    lineGap: 4,
  });
}

/**
 * Export a single page to PDF buffer.
 */
export async function exportPagePdf(
  pageId: string,
  options: PdfExportOptions = {},
): Promise<Buffer | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;

  const strokes = await getStrokes(pageId);
  if (!strokes) return null;

  const dims = getPageDimensions(options.pageSize || "original");

  const doc = new PDFDocument({
    size: [dims.width, dims.height],
    margin: 0,
    autoFirstPage: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // White background
  doc.rect(0, 0, dims.width, dims.height).fill("#ffffff");

  addStrokePageToPdf(doc, strokes, dims);

  if (options.includeTranscription) {
    const content = await getTranscriptionContent(pageId);
    if (content && content.trim()) {
      addTranscriptionPage(doc, content, dims);
    }
  }

  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}

/**
 * Export a notebook (all pages) to a single PDF buffer.
 */
export async function exportNotebookPdf(
  notebookId: string,
  pages: Array<{ id: string }>,
  options: PdfExportOptions = {},
): Promise<Buffer | null> {
  if (pages.length === 0) return null;

  const dims = getPageDimensions(options.pageSize || "original");

  const doc = new PDFDocument({
    size: [dims.width, dims.height],
    margin: 0,
    autoFirstPage: false,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  for (const page of pages) {
    doc.addPage({ size: [dims.width, dims.height], margin: 0 });

    // White background
    doc.rect(0, 0, dims.width, dims.height).fill("#ffffff");

    const strokes = await getStrokes(page.id);
    if (strokes && strokes.length > 0) {
      addStrokePageToPdf(doc, strokes, dims);
    }

    if (options.includeTranscription) {
      const content = await getTranscriptionContent(page.id);
      if (content && content.trim()) {
        addTranscriptionPage(doc, content, dims);
      }
    }
  }

  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}

/**
 * Export a page to PNG with optional scale factor.
 */
export async function exportPagePng(
  pageId: string,
  scale: number = 1,
): Promise<Buffer | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;

  const strokes = await getStrokes(pageId);
  if (!strokes) return null;

  const width = Math.round(PAGE_WIDTH * scale);
  const height = Math.round(PAGE_HEIGHT * scale);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (scale !== 1) {
    ctx.scale(scale, scale);
  }

  for (const stroke of strokes) {
    renderStrokeToCanvas(
      ctx as unknown as CanvasRenderingContext2D,
      stroke,
    );
  }

  return canvas.toBuffer("image/png") as unknown as Buffer;
}

function renderStrokeToCanvas(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
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
  ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);

  for (let i = 1; i < outlinePoints.length - 1; i++) {
    const cp = outlinePoints[i];
    const next = outlinePoints[i + 1];
    const mx = (cp[0] + next[0]) / 2;
    const my = (cp[1] + next[1]) / 2;
    ctx.quadraticCurveTo(cp[0], cp[1], mx, my);
  }

  if (outlinePoints.length > 1) {
    const last = outlinePoints[outlinePoints.length - 1];
    ctx.lineTo(last[0], last[1]);
  }

  ctx.closePath();
  ctx.fillStyle = stroke.color || "#000000";
  ctx.fill();
}

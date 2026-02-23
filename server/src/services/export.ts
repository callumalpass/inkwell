import PDFDocument from "pdfkit";
import type { Stroke } from "../types/index.js";
import { getStrokes } from "../storage/stroke-store.js";
import { getNotebookIdForPage } from "../storage/page-store.js";
import { getTranscriptionContent } from "./transcription.js";
import { strokeToSvgPath, renderStrokeToCanvas } from "./stroke-rendering.js";
import { createRenderingCanvas, canvasToPngBuffer } from "./canvas-context.js";

const PAGE_WIDTH = 1404;
const PAGE_HEIGHT = 1872;

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
    const result = strokeToSvgPath(stroke);
    if (!result) continue;

    doc.save();
    doc.scale(scaleX, scaleY);
    doc.path(result.path).fill(result.color);
    doc.restore();
  }
}

/**
 * Overlay transcription text as an invisible layer on the current PDF page.
 * The text is not visible but is present in the content stream, making the PDF searchable.
 */
function addInvisibleTranscriptionLayer(
  doc: PDFKit.PDFDocument,
  content: string,
  dims: PageDimensions,
) {
  const margin = 20;
  doc.save();
  doc.fillOpacity(0).strokeOpacity(0);
  doc.fontSize(10).font("Helvetica").fillColor("#000000");
  doc.text(content, margin, margin, {
    width: dims.width - margin * 2,
    height: dims.height - margin * 2,
    align: "left",
    lineGap: 2,
  });
  doc.restore();
}

/**
 * Export a single page to PDF buffer.
 * Returns null only if the page doesn't exist. Empty pages produce a blank PDF.
 */
export async function exportPagePdf(
  pageId: string,
  options: PdfExportOptions = {},
): Promise<Buffer | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;

  const strokes = await getStrokes(pageId);
  if (strokes === null) return null;

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
      addInvisibleTranscriptionLayer(doc, content, dims);
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
        addInvisibleTranscriptionLayer(doc, content, dims);
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
 * Returns null only if the page doesn't exist. Empty pages produce a blank white PNG.
 */
export async function exportPagePng(
  pageId: string,
  scale: number = 1,
): Promise<Buffer | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;

  const strokes = await getStrokes(pageId);
  if (strokes === null) return null;

  const width = Math.round(PAGE_WIDTH * scale);
  const height = Math.round(PAGE_HEIGHT * scale);

  const { canvas, ctx } = createRenderingCanvas(width, height);

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (scale !== 1) {
    ctx.scale(scale, scale);
  }

  for (const stroke of strokes) {
    renderStrokeToCanvas(ctx, stroke);
  }

  return canvasToPngBuffer(canvas);
}

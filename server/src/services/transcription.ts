import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { createCanvas } from "@napi-rs/canvas";
import getStroke from "perfect-freehand";
import { readFile, writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { paths } from "../storage/paths.js";
import { getNotebookIdForPage } from "../storage/page-store.js";
import { getStrokes } from "../storage/stroke-store.js";
import type { Stroke, StrokePoint } from "../types/index.js";

const PAGE_WIDTH = 1404;
const PAGE_HEIGHT = 1872;

const TRANSCRIPTION_PROMPT = `Transcribe the handwritten text in this image.

Rules:
- Preserve the original structure (paragraphs, lists, etc.)
- Use markdown formatting where appropriate
- If text is unclear, make your best guess and mark uncertain words with [?]
- Do not add any commentary or explanation, only the transcribed text
- If the image contains no text or only blank space, respond with exactly: [empty]`;

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

export async function renderPageToPng(pageId: string): Promise<Buffer | null> {
  const strokes = await getStrokes(pageId);
  if (!strokes || strokes.length === 0) return null;

  const canvas = createCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  for (const stroke of strokes) {
    renderStrokePath(ctx as unknown as CanvasRenderingContext2D, stroke);
  }

  return canvas.toBuffer("image/png") as unknown as Buffer;
}

export async function callGeminiTranscription(imageBuffer: Buffer): Promise<string> {
  if (!config.gemini.apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const base64Image = imageBuffer.toString("base64");

  const response = await ai.models.generateContent({
    model: config.gemini.model,
    contents: [
      {
        role: "user",
        parts: [
          { text: TRANSCRIPTION_PROMPT },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  const text = response.text?.trim() ?? "";
  if (text === "[empty]") return "";
  return text;
}

export async function saveTranscription(
  pageId: string,
  content: string,
): Promise<void> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) throw new Error(`Page ${pageId} not found`);

  await writeFile(paths.transcription(notebookId, pageId), content, "utf-8");
}

export async function getTranscriptionContent(
  pageId: string,
): Promise<string | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;

  try {
    return await readFile(paths.transcription(notebookId, pageId), "utf-8");
  } catch (err: any) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function transcribePage(pageId: string): Promise<string> {
  const imageBuffer = await renderPageToPng(pageId);
  if (!imageBuffer) return "";

  const content = await callGeminiTranscription(imageBuffer);
  await saveTranscription(pageId, content);
  return content;
}

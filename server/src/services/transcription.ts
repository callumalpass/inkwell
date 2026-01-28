import { GoogleGenAI, ThinkingLevel, PartMediaResolutionLevel } from "@google/genai";
import { createCanvas } from "@napi-rs/canvas";
import { readFile, writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { paths } from "../storage/paths.js";
import { getNotebookIdForPage, getPage } from "../storage/page-store.js";
import { getNotebook } from "../storage/notebook-store.js";
import { getStrokes } from "../storage/stroke-store.js";
import { renderStrokeToCanvas } from "./stroke-rendering.js";
import { getMarkdownConfig } from "../storage/config-store.js";
import {
  buildMarkdownWithFrontmatter,
  stripFrontmatter,
  type TemplateContext,
} from "./frontmatter.js";

const PAGE_WIDTH = 1404;
const PAGE_HEIGHT = 1872;

// Target width for transcription images - balanced for OCR quality vs cost
// Gemini's media_resolution_high uses 1120 tokens, so ~1120px width is efficient
const TRANSCRIPTION_TARGET_WIDTH = 1120;

const TRANSCRIPTION_PROMPT = `Transcribe the handwritten text in this image.

Rules:
- Preserve the original structure (paragraphs, lists, etc.)
- Use markdown formatting where appropriate
- If text is unclear, make your best guess and mark uncertain words with [?]
- Do not add any commentary or explanation, only the transcribed text
- If the image contains no text or only blank space, respond with exactly: [empty]`;

/**
 * Render page strokes to PNG at full resolution for export.
 */
export async function renderPageToPng(pageId: string): Promise<Buffer | null> {
  const strokes = await getStrokes(pageId);
  if (!strokes || strokes.length === 0) return null;

  const canvas = createCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  for (const stroke of strokes) {
    renderStrokeToCanvas(ctx as unknown as CanvasRenderingContext2D, stroke);
  }

  return canvas.toBuffer("image/png") as unknown as Buffer;
}

/**
 * Render page strokes to PNG at a reduced resolution optimized for transcription.
 * This reduces the image size sent to Gemini, saving tokens and improving latency.
 */
export async function renderPageForTranscription(pageId: string): Promise<Buffer | null> {
  const strokes = await getStrokes(pageId);
  if (!strokes || strokes.length === 0) return null;

  // Calculate scaled dimensions maintaining aspect ratio
  const scale = TRANSCRIPTION_TARGET_WIDTH / PAGE_WIDTH;
  const scaledWidth = TRANSCRIPTION_TARGET_WIDTH;
  const scaledHeight = Math.round(PAGE_HEIGHT * scale);

  const canvas = createCanvas(scaledWidth, scaledHeight);
  const ctx = canvas.getContext("2d");

  // Fill white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, scaledWidth, scaledHeight);

  // Apply scaling transform for stroke rendering
  ctx.scale(scale, scale);

  for (const stroke of strokes) {
    renderStrokeToCanvas(ctx as unknown as CanvasRenderingContext2D, stroke);
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
            mediaResolution: {
              level: PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH,
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

  const page = await getPage(pageId);
  const notebook = page ? await getNotebook(notebookId) : null;
  let fileContent = content;

  if (page && notebook) {
    try {
      const mdConfig = await getMarkdownConfig();
      if (mdConfig.frontmatter.enabled) {
        const context: TemplateContext = {
          page,
          notebook,
          transcriptionContent: content,
        };
        fileContent = buildMarkdownWithFrontmatter(mdConfig, context, content);
      }
    } catch {
      // If config loading fails, save without frontmatter
    }
  }

  await writeFile(paths.transcription(notebookId, pageId), fileContent, "utf-8");
}

export async function getTranscriptionContent(
  pageId: string,
): Promise<string | null> {
  const notebookId = await getNotebookIdForPage(pageId);
  if (!notebookId) return null;

  try {
    const raw = await readFile(paths.transcription(notebookId, pageId), "utf-8");
    // Strip frontmatter if present, return only the transcription body
    return stripFrontmatter(raw);
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return null;
    throw err;
  }
}

export async function transcribePage(pageId: string): Promise<string> {
  // Use optimized smaller image for transcription to reduce token usage
  const imageBuffer = await renderPageForTranscription(pageId);
  if (!imageBuffer) return "";

  const content = await callGeminiTranscription(imageBuffer);
  await saveTranscription(pageId, content);
  return content;
}

import type { FastifyInstance } from "fastify";
import { strokeStore, pageStore } from "../storage/index.js";
import type { Stroke } from "../types/index.js";
import { broadcastToPage } from "../ws/handlers.js";
import { invalidateThumbnail } from "../services/thumbnail.js";
import { config } from "../config.js";
import { enqueueTranscription } from "../services/transcription-queue.js";
import { getAppSettings } from "../storage/config-store.js";

// Track idle timers per page for auto-transcription
const idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Clear the auto-transcribe idle timer for a page (e.g. on page deletion). */
export function clearIdleTimer(pageId: string): void {
  const timer = idleTimers.get(pageId);
  if (timer) {
    clearTimeout(timer);
    idleTimers.delete(pageId);
  }
}

async function scheduleAutoTranscribe(pageId: string): Promise<void> {
  if (!config.gemini.apiKey) return;

  // Check persisted setting first, fall back to env var
  const appSettings = await getAppSettings();
  const autoEnabled =
    appSettings.autoTranscribe !== undefined
      ? appSettings.autoTranscribe
      : config.transcription.autoTranscribe;
  if (!autoEnabled) return;

  // Clear existing timer for this page
  const existing = idleTimers.get(pageId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    idleTimers.delete(pageId);
    try {
      const page = await pageStore.getPage(pageId);
      if (!page) return;
      // Only auto-transcribe if not already complete or in progress
      if (
        page.transcription?.status === "complete" ||
        page.transcription?.status === "pending" ||
        page.transcription?.status === "processing"
      ) {
        return;
      }
      enqueueTranscription(pageId, page.notebookId);
    } catch {
      // Best-effort auto-transcribe
    }
  }, config.transcription.idleDelayMs);

  idleTimers.set(pageId, timer);
}

export function strokeRoutes(app: FastifyInstance) {
  app.get<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/strokes",
    async (req, reply) => {
      const strokes = await strokeStore.getStrokes(req.params.pageId);
      if (strokes === null) return reply.code(404).send({ error: "Page not found" });
      return strokes;
    },
  );

  app.post<{ Params: { pageId: string }; Body: { strokes: Stroke[] } }>(
    "/api/pages/:pageId/strokes",
    {
      schema: {
        body: {
          type: "object",
          required: ["strokes"],
          properties: {
            strokes: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "points", "color", "width", "createdAt"],
                properties: {
                  id: { type: "string" },
                  points: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["x", "y", "pressure"],
                      properties: {
                        x: { type: "number" },
                        y: { type: "number" },
                        pressure: { type: "number" },
                      },
                      additionalProperties: false,
                    },
                  },
                  color: { type: "string", maxLength: 50 },
                  width: { type: "number", minimum: 0.1, maximum: 100 },
                  penStyle: { type: "string", enum: ["pressure", "uniform", "ballpoint"] },
                  createdAt: { type: "string" },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const result = await strokeStore.appendStrokes(
        req.params.pageId,
        req.body.strokes,
      );
      if (result === null) return reply.code(404).send({ error: "Page not found" });

      broadcastToPage(app, req.params.pageId, {
        type: "strokes:added",
        pageId: req.params.pageId,
        strokes: req.body.strokes,
      });

      invalidateThumbnail(req.params.pageId);
      scheduleAutoTranscribe(req.params.pageId);

      return { count: result.length };
    },
  );

  app.delete<{ Params: { pageId: string; strokeId: string } }>(
    "/api/pages/:pageId/strokes/:strokeId",
    async (req, reply) => {
      const result = await strokeStore.deleteStroke(
        req.params.pageId,
        req.params.strokeId,
      );
      if (result === null) return reply.code(404).send({ error: "Page not found" });

      broadcastToPage(app, req.params.pageId, {
        type: "strokes:deleted",
        pageId: req.params.pageId,
        strokeId: req.params.strokeId,
      });

      invalidateThumbnail(req.params.pageId);

      return { count: result.length };
    },
  );

  app.delete<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/strokes",
    async (req, reply) => {
      const cleared = await strokeStore.clearStrokes(req.params.pageId);
      if (!cleared) return reply.code(404).send({ error: "Page not found" });

      broadcastToPage(app, req.params.pageId, {
        type: "strokes:cleared",
        pageId: req.params.pageId,
      });

      invalidateThumbnail(req.params.pageId);

      return reply.code(204).send();
    },
  );
}

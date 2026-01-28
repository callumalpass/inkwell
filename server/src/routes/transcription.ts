import type { FastifyInstance } from "fastify";
import { pageStore, notebookStore } from "../storage/index.js";
import { getTranscriptionContent, saveTranscription } from "../services/transcription.js";
import {
  enqueueTranscription,
  getQueueStatus,
} from "../services/transcription-queue.js";

export function transcriptionRoutes(app: FastifyInstance) {
  // Trigger transcription for a single page
  app.post<{
    Params: { pageId: string };
    Body: { force?: boolean };
  }>("/api/pages/:pageId/transcribe", {
    schema: {
      body: {
        type: "object",
        properties: {
          force: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const page = await pageStore.getPage(req.params.pageId);
    if (!page) return reply.code(404).send({ error: "Page not found" });

    const force = req.body?.force ?? false;

    // Don't re-transcribe if already complete, unless forced
    if (
      !force &&
      page.transcription?.status === "complete"
    ) {
      return { status: "complete", message: "Already transcribed" };
    }

    // Don't queue if already pending/processing
    if (
      !force &&
      (page.transcription?.status === "pending" ||
        page.transcription?.status === "processing")
    ) {
      return { status: page.transcription.status, message: "Already in queue" };
    }

    enqueueTranscription(page.id, page.notebookId, force);

    return { status: "pending", pageId: page.id };
  });

  // Set transcription content for a page (manual edit / import)
  app.put<{ Params: { pageId: string }; Body: { content: string } }>(
    "/api/pages/:pageId/transcription",
    {
      schema: {
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const page = await pageStore.getPage(req.params.pageId);
      if (!page) return reply.code(404).send({ error: "Page not found" });

      await saveTranscription(req.params.pageId, req.body.content);

      // Update page transcription status
      await pageStore.updatePage(req.params.pageId, {
        transcription: {
          status: "complete",
          lastAttempt: new Date().toISOString(),
          error: null,
        },
      });

      return { status: "complete", pageId: req.params.pageId };
    },
  );

  // Get transcription content and status for a page
  app.get<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/transcription",
    async (req, reply) => {
      const page = await pageStore.getPage(req.params.pageId);
      if (!page) return reply.code(404).send({ error: "Page not found" });

      const content = await getTranscriptionContent(req.params.pageId);

      return {
        status: page.transcription?.status ?? "none",
        content: content ?? "",
        lastAttempt: page.transcription?.lastAttempt ?? null,
        error: page.transcription?.error ?? null,
      };
    },
  );

  // Bulk transcribe all pages in a notebook
  app.post<{ Params: { notebookId: string } }>(
    "/api/notebooks/:notebookId/transcribe",
    async (req, reply) => {
      const notebook = await notebookStore.getNotebook(req.params.notebookId);
      if (!notebook)
        return reply.code(404).send({ error: "Notebook not found" });

      const pages = await pageStore.listPages(req.params.notebookId);
      let queued = 0;

      for (const page of pages) {
        if (page.transcription?.status !== "complete") {
          enqueueTranscription(page.id, page.notebookId);
          queued++;
        }
      }

      return { queued, total: pages.length };
    },
  );

  // Get queue status
  app.get("/api/transcription/queue", async () => {
    return getQueueStatus();
  });
}

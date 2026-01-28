import type { FastifyInstance } from "fastify";
import { configStore, notebookStore, pageStore } from "../storage/index.js";
import {
  syncPage,
  syncNotebook,
  SyncError,
} from "../services/markdown-sync.js";

export function markdownSyncRoutes(app: FastifyInstance) {
  // Get markdown config
  app.get("/api/config/markdown", async () => {
    return configStore.getMarkdownConfig();
  });

  // Update markdown config
  app.patch<{
    Body: {
      frontmatter?: {
        enabled?: boolean;
        template?: Record<string, string>;
      };
      sync?: {
        enabled?: boolean;
        destination?: string;
        filenameTemplate?: string;
        syncOnTranscription?: boolean;
        syncOnManual?: boolean;
      };
    };
  }>(
    "/api/config/markdown",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            frontmatter: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                template: {
                  type: "object",
                  additionalProperties: { type: "string" },
                },
              },
              additionalProperties: false,
            },
            sync: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                destination: { type: "string" },
                filenameTemplate: { type: "string" },
                syncOnTranscription: { type: "boolean" },
                syncOnManual: { type: "boolean" },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req) => {
      return configStore.updateMarkdownConfig(req.body);
    },
  );

  // Get sync status
  app.get("/api/sync/status", async () => {
    return configStore.getSyncStatus();
  });

  // Sync a single page
  app.post<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/sync",
    async (req, reply) => {
      try {
        const result = await syncPage(req.params.pageId);
        return result;
      } catch (err) {
        if (err instanceof SyncError) {
          const status = err.code === "PAGE_NOT_FOUND" || err.code === "NOTEBOOK_NOT_FOUND"
            ? 404
            : 400;
          return reply.code(status).send({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    },
  );

  // Sync all pages in a notebook
  app.post<{ Params: { notebookId: string } }>(
    "/api/notebooks/:notebookId/sync",
    async (req, reply) => {
      const notebook = await notebookStore.getNotebook(req.params.notebookId);
      if (!notebook)
        return reply.code(404).send({ error: "Notebook not found" });

      try {
        const result = await syncNotebook(req.params.notebookId);
        return result;
      } catch (err) {
        if (err instanceof SyncError) {
          return reply.code(400).send({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    },
  );
}

import type { FastifyInstance } from "fastify";
import { pageStore, notebookStore } from "../storage/index.js";
import {
  exportPagePdf,
  exportNotebookPdf,
  exportPagePng,
} from "../services/export.js";

export function exportRoutes(app: FastifyInstance) {
  // Export single page as PDF
  app.get<{
    Params: { pageId: string };
    Querystring: {
      includeTranscription?: string;
      pageSize?: string;
    };
  }>(
    "/api/pages/:pageId/export/pdf",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            includeTranscription: { type: "string", enum: ["true", "false"] },
            pageSize: { type: "string", enum: ["original", "a4", "letter"] },
          },
        },
      },
    },
    async (req, reply) => {
      const { pageId } = req.params;
      const page = await pageStore.getPage(pageId);
      if (!page) return reply.code(404).send({ error: "Page not found" });

      const buffer = await exportPagePdf(pageId, {
        includeTranscription: req.query.includeTranscription === "true",
        pageSize: (req.query.pageSize as "original" | "a4" | "letter") || "original",
      });

      if (!buffer) {
        return reply.code(404).send({ error: "Page not found" });
      }

      return reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="${pageId}.pdf"`,
        )
        .send(buffer);
    },
  );

  // Export notebook as PDF
  app.get<{
    Params: { notebookId: string };
    Querystring: {
      includeTranscription?: string;
      pageSize?: string;
    };
  }>(
    "/api/notebooks/:notebookId/export/pdf",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            includeTranscription: { type: "string", enum: ["true", "false"] },
            pageSize: { type: "string", enum: ["original", "a4", "letter"] },
          },
        },
      },
    },
    async (req, reply) => {
      const { notebookId } = req.params;
      const notebook = await notebookStore.getNotebook(notebookId);
      if (!notebook) {
        return reply.code(404).send({ error: "Notebook not found" });
      }

      const pages = await pageStore.listPages(notebookId);
      if (pages.length === 0) {
        return reply.code(404).send({ error: "Notebook has no pages" });
      }

      const buffer = await exportNotebookPdf(
        notebookId,
        pages.map((p) => ({ id: p.id })),
        {
          includeTranscription: req.query.includeTranscription === "true",
          pageSize: (req.query.pageSize as "original" | "a4" | "letter") || "original",
        },
      );

      if (!buffer) {
        return reply.code(500).send({ error: "Export failed" });
      }

      const safeTitle = notebook.title.replace(/[^a-zA-Z0-9_-]/g, "_");
      return reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="${safeTitle}.pdf"`,
        )
        .send(buffer);
    },
  );

  // Export single page as PNG
  app.get<{
    Params: { pageId: string };
    Querystring: { scale?: string };
  }>(
    "/api/pages/:pageId/export/png",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            scale: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { pageId } = req.params;
      const page = await pageStore.getPage(pageId);
      if (!page) return reply.code(404).send({ error: "Page not found" });

      const scale = Math.min(Math.max(parseFloat(req.query.scale || "1") || 1, 0.1), 4);

      const buffer = await exportPagePng(pageId, scale);
      if (!buffer) {
        return reply.code(404).send({ error: "Page not found" });
      }

      return reply
        .header("Content-Type", "image/png")
        .header(
          "Content-Disposition",
          `attachment; filename="${pageId}.png"`,
        )
        .send(buffer);
    },
  );
}

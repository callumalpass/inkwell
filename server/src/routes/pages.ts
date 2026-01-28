import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { notebookStore, pageStore } from "../storage/index.js";
import type { PageMeta } from "../types/index.js";
import { clearIdleTimer } from "./strokes.js";
import { regenerateFrontmatter } from "../services/markdown-sync.js";

// Canvas layout constants for auto-positioning
const CANVAS_PAGE_WIDTH = 400;
const CANVAS_PAGE_HEIGHT = Math.round(CANVAS_PAGE_WIDTH * (1872 / 1404));
const CANVAS_GAP = 60;
const CANVAS_COLS = 3;

function autoPosition(pageIndex: number): { canvasX: number; canvasY: number } {
  const col = pageIndex % CANVAS_COLS;
  const row = Math.floor(pageIndex / CANVAS_COLS);
  return {
    canvasX: col * (CANVAS_PAGE_WIDTH + CANVAS_GAP),
    canvasY: row * (CANVAS_PAGE_HEIGHT + CANVAS_GAP),
  };
}

export function pageRoutes(app: FastifyInstance) {
  app.get<{ Params: { notebookId: string } }>(
    "/api/notebooks/:notebookId/pages",
    async (req, reply) => {
      const notebook = await notebookStore.getNotebook(req.params.notebookId);
      if (!notebook) return reply.code(404).send({ error: "Notebook not found" });
      return pageStore.listPages(req.params.notebookId);
    },
  );

  app.post<{ Params: { notebookId: string } }>(
    "/api/notebooks/:notebookId/pages",
    async (req, reply) => {
      const notebook = await notebookStore.getNotebook(req.params.notebookId);
      if (!notebook) return reply.code(404).send({ error: "Notebook not found" });

      const pages = await pageStore.listPages(req.params.notebookId);
      const pageIndex = pages.length;
      const pos = autoPosition(pageIndex);
      const now = new Date().toISOString();
      const meta: PageMeta = {
        id: `pg_${nanoid(12)}`,
        notebookId: req.params.notebookId,
        pageNumber: pageIndex + 1,
        canvasX: pos.canvasX,
        canvasY: pos.canvasY,
        createdAt: now,
        updatedAt: now,
      };
      await pageStore.createPage(meta);
      return reply.code(201).send(meta);
    },
  );

  app.get<{ Params: { pageId: string } }>(
    "/api/pages/:pageId",
    async (req, reply) => {
      const page = await pageStore.getPage(req.params.pageId);
      if (!page) return reply.code(404).send({ error: "Page not found" });
      return page;
    },
  );

  app.patch<{
    Params: { pageId: string };
    Body: {
      canvasX?: number;
      canvasY?: number;
      pageNumber?: number;
      links?: string[];
      tags?: string[];
    };
  }>(
    "/api/pages/:pageId",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            canvasX: { type: "number" },
            canvasY: { type: "number" },
            pageNumber: { type: "integer", minimum: 1 },
            links: {
              type: "array",
              items: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
            },
            tags: {
              type: "array",
              items: { type: "string", minLength: 1, maxLength: 100 },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { canvasX, canvasY, pageNumber, links, tags } = req.body;
      const updates: Partial<Pick<PageMeta, "canvasX" | "canvasY" | "pageNumber" | "links" | "tags" | "transcription">> = {};
      if (canvasX !== undefined) updates.canvasX = canvasX;
      if (canvasY !== undefined) updates.canvasY = canvasY;
      if (pageNumber !== undefined) updates.pageNumber = pageNumber;
      if (links !== undefined) updates.links = links;
      if (tags !== undefined) updates.tags = tags;

      const updated = await pageStore.updatePage(req.params.pageId, updates);
      if (!updated) return reply.code(404).send({ error: "Page not found" });

      // Regenerate frontmatter when tags or metadata change
      if (tags !== undefined) {
        regenerateFrontmatter(req.params.pageId).catch(() => {
          // Best-effort: frontmatter regeneration failure is non-fatal
        });
      }

      return updated;
    },
  );

  app.delete<{ Params: { pageId: string } }>(
    "/api/pages/:pageId",
    async (req, reply) => {
      const deleted = await pageStore.deletePage(req.params.pageId);
      if (!deleted) return reply.code(404).send({ error: "Page not found" });
      clearIdleTimer(req.params.pageId);
      return reply.code(204).send();
    },
  );
}

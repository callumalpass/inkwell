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
const PAGE_WIDTH = 1404;
const PAGE_HEIGHT = 1872;

function autoPosition(pages: PageMeta[]): { canvasX: number; canvasY: number } {
  if (pages.length === 0) {
    return { canvasX: 0, canvasY: 0 };
  }

  const lowestY = Math.max(...pages.map((page) => page.canvasY));
  return {
    canvasX: 0,
    canvasY: lowestY + CANVAS_PAGE_HEIGHT + CANVAS_GAP,
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
      const pos = autoPosition(pages);
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
      inlineLinks?: PageMeta["inlineLinks"];
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
            inlineLinks: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "rect", "target", "createdAt", "updatedAt"],
                properties: {
                  id: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
                  rect: {
                    type: "object",
                    required: ["x", "y", "width", "height"],
                    properties: {
                      x: { type: "number", minimum: 0, maximum: PAGE_WIDTH },
                      y: { type: "number", minimum: 0, maximum: PAGE_HEIGHT },
                      width: { type: "number", minimum: 1, maximum: PAGE_WIDTH },
                      height: { type: "number", minimum: 1, maximum: PAGE_HEIGHT },
                    },
                    additionalProperties: false,
                  },
                  target: {
                    oneOf: [
                      {
                        type: "object",
                        required: ["type", "pageId", "notebookId"],
                        properties: {
                          type: { const: "page" },
                          pageId: { type: "string", pattern: "^pg_[a-zA-Z0-9_-]+$" },
                          notebookId: { type: "string", pattern: "^nb_[a-zA-Z0-9_-]+$" },
                          label: { type: "string", maxLength: 200 },
                        },
                        additionalProperties: false,
                      },
                      {
                        type: "object",
                        required: ["type", "url"],
                        properties: {
                          type: { const: "url" },
                          url: { type: "string", pattern: "^https?://", maxLength: 2000 },
                          label: { type: "string", maxLength: 200 },
                        },
                        additionalProperties: false,
                      },
                    ],
                  },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
                additionalProperties: false,
              },
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
      const { canvasX, canvasY, pageNumber, links, inlineLinks, tags } = req.body;
      const updates: Partial<Pick<PageMeta, "canvasX" | "canvasY" | "pageNumber" | "links" | "inlineLinks" | "tags" | "transcription">> = {};
      if (canvasX !== undefined) updates.canvasX = canvasX;
      if (canvasY !== undefined) updates.canvasY = canvasY;
      if (pageNumber !== undefined) updates.pageNumber = pageNumber;
      if (links !== undefined) updates.links = links;
      if (inlineLinks !== undefined) updates.inlineLinks = inlineLinks;
      if (tags !== undefined) updates.tags = tags;

      const updated = await pageStore.updatePage(req.params.pageId, updates);
      if (!updated) return reply.code(404).send({ error: "Page not found" });

      // Regenerate frontmatter when tags/links metadata changes
      if (tags !== undefined || links !== undefined || inlineLinks !== undefined) {
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

  app.post<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/duplicate",
    async (req, reply) => {
      const duplicated = await pageStore.duplicatePage(req.params.pageId);
      if (!duplicated) return reply.code(404).send({ error: "Page not found" });
      return reply.code(201).send(duplicated);
    },
  );

  app.post<{
    Body: { pageIds: string[]; targetNotebookId: string };
  }>(
    "/api/pages/move",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            pageIds: {
              type: "array",
              items: { type: "string", pattern: "^pg_[a-zA-Z0-9_-]+$" },
              minItems: 1,
            },
            targetNotebookId: {
              type: "string",
              pattern: "^nb_[a-zA-Z0-9_-]+$",
            },
          },
          required: ["pageIds", "targetNotebookId"],
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { pageIds, targetNotebookId } = req.body;
      const notebook = await notebookStore.getNotebook(targetNotebookId);
      if (!notebook) return reply.code(404).send({ error: "Target notebook not found" });
      try {
        const moved = await pageStore.movePages(pageIds, targetNotebookId);
        await Promise.all(
          moved.map((page) =>
            regenerateFrontmatter(page.id).catch(() => {
              // Best-effort: frontmatter regeneration failure is non-fatal
            }),
          ),
        );
        return { moved };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Move failed";
        return reply.code(400).send({ error: message });
      }
    },
  );
}

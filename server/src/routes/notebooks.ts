import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { notebookStore, pageStore } from "../storage/index.js";
import type { NotebookMeta, NotebookSettings } from "../types/index.js";

export function notebookRoutes(app: FastifyInstance) {
  app.get("/api/notebooks", async () => {
    const notebooks = await notebookStore.listNotebooks();
    const enriched = await Promise.all(
      notebooks.map(async (nb) => {
        const pages = await pageStore.listPages(nb.id);
        return {
          ...nb,
          pageCount: pages.length,
          coverPageId: pages.length > 0 ? pages[0].id : null,
        };
      }),
    );
    return enriched;
  });

  app.get<{ Params: { id: string } }>("/api/notebooks/:id", async (req, reply) => {
    const notebook = await notebookStore.getNotebook(req.params.id);
    if (!notebook) return reply.code(404).send({ error: "Notebook not found" });
    return notebook;
  });

  app.post<{ Body: { title: string } }>("/api/notebooks", {
    schema: {
      body: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 200 },
        },
      },
    },
  }, async (req, reply) => {
    const now = new Date().toISOString();
    const meta: NotebookMeta = {
      id: `nb_${nanoid(12)}`,
      title: req.body.title || "Untitled",
      createdAt: now,
      updatedAt: now,
    };
    await notebookStore.createNotebook(meta);
    return reply.code(201).send(meta);
  });

  app.patch<{
    Params: { id: string };
    Body: { title?: string; settings?: NotebookSettings };
  }>(
    "/api/notebooks/:id",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            title: { type: "string", maxLength: 200 },
            settings: {
              type: "object",
              properties: {
                defaultTool: {
                  type: "string",
                  enum: ["pen", "highlighter", "eraser"],
                },
                defaultColor: {
                  type: "string",
                  pattern: "^#[0-9a-fA-F]{6}$",
                },
                defaultStrokeWidth: {
                  type: "number",
                  minimum: 1,
                  maximum: 50,
                },
                gridType: {
                  type: "string",
                  enum: ["none", "lined", "grid", "dotgrid"],
                },
                backgroundLineSpacing: {
                  type: "number",
                  enum: [32, 40, 48, 56, 64],
                },
                bookmarks: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["id", "pageId", "createdAt", "order"],
                    properties: {
                      id: { type: "string", minLength: 1, maxLength: 100 },
                      pageId: { type: "string", minLength: 1, maxLength: 100 },
                      label: { type: "string", maxLength: 120 },
                      parentId: {
                        anyOf: [
                          { type: "string", minLength: 1, maxLength: 100 },
                          { type: "null" },
                        ],
                      },
                      createdAt: { type: "string", format: "date-time" },
                      order: { type: "number" },
                    },
                    additionalProperties: false,
                  },
                },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const updates: Partial<Pick<NotebookMeta, "title" | "settings">> = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.settings !== undefined) updates.settings = req.body.settings;

      const updated = await notebookStore.updateNotebook(req.params.id, updates);
      if (!updated) return reply.code(404).send({ error: "Notebook not found" });
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>("/api/notebooks/:id", async (req, reply) => {
    const deleted = await notebookStore.deleteNotebook(req.params.id);
    if (!deleted) return reply.code(404).send({ error: "Notebook not found" });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/api/notebooks/:id/duplicate", async (req, reply) => {
    const duplicated = await notebookStore.duplicateNotebook(req.params.id);
    if (!duplicated) return reply.code(404).send({ error: "Notebook not found" });
    return reply.code(201).send(duplicated);
  });
}

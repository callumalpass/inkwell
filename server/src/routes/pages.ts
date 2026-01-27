import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { notebookStore, pageStore } from "../storage/index.js";
import type { PageMeta } from "../types/index.js";

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
      const now = new Date().toISOString();
      const meta: PageMeta = {
        id: `pg_${nanoid(12)}`,
        notebookId: req.params.notebookId,
        pageNumber: pages.length + 1,
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

  app.delete<{ Params: { pageId: string } }>(
    "/api/pages/:pageId",
    async (req, reply) => {
      const deleted = await pageStore.deletePage(req.params.pageId);
      if (!deleted) return reply.code(404).send({ error: "Page not found" });
      return reply.code(204).send();
    },
  );
}

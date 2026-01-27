import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { notebookStore } from "../storage/index.js";
import type { NotebookMeta } from "../types/index.js";

export function notebookRoutes(app: FastifyInstance) {
  app.get("/api/notebooks", async () => {
    return notebookStore.listNotebooks();
  });

  app.get<{ Params: { id: string } }>("/api/notebooks/:id", async (req, reply) => {
    const notebook = await notebookStore.getNotebook(req.params.id);
    if (!notebook) return reply.code(404).send({ error: "Notebook not found" });
    return notebook;
  });

  app.post<{ Body: { title: string } }>("/api/notebooks", async (req, reply) => {
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

  app.patch<{ Params: { id: string }; Body: { title?: string } }>(
    "/api/notebooks/:id",
    async (req, reply) => {
      const updated = await notebookStore.updateNotebook(req.params.id, req.body);
      if (!updated) return reply.code(404).send({ error: "Notebook not found" });
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>("/api/notebooks/:id", async (req, reply) => {
    const deleted = await notebookStore.deleteNotebook(req.params.id);
    if (!deleted) return reply.code(404).send({ error: "Notebook not found" });
    return reply.code(204).send();
  });
}

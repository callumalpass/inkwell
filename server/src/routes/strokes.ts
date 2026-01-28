import type { FastifyInstance } from "fastify";
import { strokeStore } from "../storage/index.js";
import type { Stroke } from "../types/index.js";
import { broadcastToPage } from "../ws/handlers.js";
import { invalidateThumbnail } from "../services/thumbnail.js";

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

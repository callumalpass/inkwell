import type { FastifyInstance } from "fastify";
import {
  getCachedThumbnail,
  generateAndCacheThumbnail,
} from "../services/thumbnail.js";

export function thumbnailRoutes(app: FastifyInstance) {
  app.get<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/thumbnail",
    async (req, reply) => {
      const { pageId } = req.params;

      // Try cached first
      let buffer = await getCachedThumbnail(pageId);
      if (!buffer) {
        buffer = await generateAndCacheThumbnail(pageId);
      }

      if (!buffer) {
        return reply.code(404).send({ error: "Page not found" });
      }

      return reply
        .header("Content-Type", "image/png")
        .header("Cache-Control", "public, max-age=60")
        .send(buffer);
    },
  );
}

import type { FastifyInstance } from "fastify";
import { searchTranscriptions } from "../services/search.js";

export function searchRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { q?: string; notebook?: string; limit?: string };
  }>(
    "/api/search",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            q: { type: "string", minLength: 1 },
            notebook: { type: "string" },
            limit: { type: "string" },
          },
          required: ["q"],
        },
      },
    },
    async (req, reply) => {
      const { q, notebook, limit } = req.query;

      const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100) : 20;

      const result = await searchTranscriptions(q!, {
        notebook,
        limit: parsedLimit,
      });

      return result;
    },
  );
}

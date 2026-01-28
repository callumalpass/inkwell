import type { FastifyInstance } from "fastify";
import { searchTranscriptions } from "../services/search.js";

export function searchRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      q?: string;
      notebook?: string;
      limit?: string;
      offset?: string;
      matchType?: string;
    };
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
            offset: { type: "string" },
            matchType: { type: "string" },
          },
          required: ["q"],
        },
      },
    },
    async (req, reply) => {
      const { q, notebook, limit, offset, matchType } = req.query;

      const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100) : 20;
      const parsedOffset = offset ? Math.max(parseInt(offset, 10) || 0, 0) : 0;

      // Parse matchType filter (comma-separated values)
      const matchTypeFilter = matchType
        ? (matchType.split(",").filter(Boolean) as Array<"transcription" | "tag" | "notebook">)
        : undefined;

      const result = await searchTranscriptions(q!, {
        notebook,
        limit: parsedLimit,
        offset: parsedOffset,
        matchType: matchTypeFilter,
      });

      return result;
    },
  );
}

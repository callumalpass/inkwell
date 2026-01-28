import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config.js";
import { registerRoutes } from "./routes/index.js";
import { registerWebSocket } from "./ws/index.js";
import { broadcastToPage } from "./ws/handlers.js";
import { setTranscriptionListener } from "./services/transcription-queue.js";

// Route params that must match safe ID format (nanoid with prefix)
const ID_PARAM_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ID_PARAM_NAMES = new Set(["id", "pageId", "notebookId", "strokeId"]);

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Validate route ID params to prevent path traversal
  app.addHook("preValidation", async (req, reply) => {
    const params = req.params as Record<string, string> | undefined;
    if (!params) return;
    for (const [key, value] of Object.entries(params)) {
      if (ID_PARAM_NAMES.has(key) && !ID_PARAM_PATTERN.test(value)) {
        return reply.code(400).send({ error: `Invalid ${key} format` });
      }
    }
  });

  registerRoutes(app);
  registerWebSocket(app);

  // Wire transcription queue events to WebSocket broadcasts
  setTranscriptionListener((pageId, event, data) => {
    if (event === "complete") {
      broadcastToPage(app, pageId, {
        type: "transcription:complete",
        pageId,
        content: data.content,
      });
    } else if (event === "failed") {
      broadcastToPage(app, pageId, {
        type: "transcription:failed",
        pageId,
        error: data.error,
      });
    }
  });

  return app;
}

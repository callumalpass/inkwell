import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config.js";
import { registerRoutes } from "./routes/index.js";
import { registerWebSocket } from "./ws/index.js";
import { broadcastToPage } from "./ws/handlers.js";
import { setTranscriptionListener } from "./services/transcription-queue.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

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

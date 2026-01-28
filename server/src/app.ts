import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import websocket from "@fastify/websocket";
import { config } from "./config.js";
import { registerRoutes } from "./routes/index.js";
import { registerWebSocket } from "./ws/index.js";
import { broadcastToPage } from "./ws/handlers.js";
import { setTranscriptionListener, initQueue } from "./services/transcription-queue.js";
import { syncPage, SyncError } from "./services/markdown-sync.js";
import { getMarkdownConfig } from "./storage/config-store.js";

// Route params that must match safe ID format (nanoid with prefix)
const ID_PARAM_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ID_PARAM_NAMES = new Set(["id", "pageId", "notebookId", "strokeId"]);

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(compress, { threshold: 1024 });
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

  // Initialize transcription queue (resumes any pending jobs from disk)
  await initQueue();

  // Wire transcription queue events to WebSocket broadcasts
  setTranscriptionListener((pageId, event, data) => {
    if (event === "complete") {
      broadcastToPage(app, pageId, {
        type: "transcription:complete",
        pageId,
        content: data.content,
      });

      // Auto-sync to destination if configured
      (async () => {
        try {
          const mdConfig = await getMarkdownConfig();
          if (mdConfig.sync.enabled && mdConfig.sync.syncOnTranscription) {
            const result = await syncPage(pageId);
            broadcastToPage(app, pageId, {
              type: "markdown:synced",
              pageId,
              destination: result.destination,
            });
          }
        } catch (err) {
          if (err instanceof SyncError) {
            broadcastToPage(app, pageId, {
              type: "markdown:sync.failed",
              pageId,
              error: err.message,
            });
          }
          // Sync failures are non-fatal; log and continue
          app.log.error({ err, pageId }, "Auto-sync failed after transcription");
        }
      })();
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

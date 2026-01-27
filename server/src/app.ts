import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config.js";
import { registerRoutes } from "./routes/index.js";
import { registerWebSocket } from "./ws/index.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  registerRoutes(app);
  registerWebSocket(app);

  return app;
}

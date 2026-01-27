import type { FastifyInstance } from "fastify";
import { subscribeTo, unsubscribeFrom } from "./handlers.js";

export function registerWebSocket(app: FastifyInstance) {
  app.get<{ Params: { pageId: string } }>(
    "/ws/page/:pageId",
    { websocket: true },
    (socket, req) => {
      const { pageId } = req.params;
      subscribeTo(pageId, socket);

      socket.on("close", () => {
        unsubscribeFrom(pageId, socket);
      });

      socket.on("error", () => {
        unsubscribeFrom(pageId, socket);
      });
    },
  );
}

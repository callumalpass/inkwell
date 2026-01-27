import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";

const pageSubscriptions = new Map<string, Set<WebSocket>>();

export function subscribeTo(pageId: string, socket: WebSocket) {
  if (!pageSubscriptions.has(pageId)) {
    pageSubscriptions.set(pageId, new Set());
  }
  pageSubscriptions.get(pageId)!.add(socket);
}

export function unsubscribeFrom(pageId: string, socket: WebSocket) {
  const subs = pageSubscriptions.get(pageId);
  if (subs) {
    subs.delete(socket);
    if (subs.size === 0) pageSubscriptions.delete(pageId);
  }
}

export function broadcastToPage(
  _app: FastifyInstance,
  pageId: string,
  message: unknown,
) {
  const subs = pageSubscriptions.get(pageId);
  if (!subs) return;
  const data = JSON.stringify(message);
  for (const socket of subs) {
    if (socket.readyState === 1) {
      socket.send(data);
    }
  }
}

import { useEffect, useRef } from "react";
import { usePageStore } from "../stores/page-store";

export function useWebSocket(pageId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const addSavedStrokes = usePageStore((s) => s.addSavedStrokes);
  const removeSavedStroke = usePageStore((s) => s.removeSavedStroke);
  const clearSavedStrokes = usePageStore((s) => s.clearSavedStrokes);

  useEffect(() => {
    if (!pageId) return;

    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let shouldReconnect = true;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/page/${pageId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "strokes:added":
              addSavedStrokes(msg.strokes);
              break;
            case "strokes:deleted":
              removeSavedStroke(msg.strokeId);
              break;
            case "strokes:cleared":
              clearSavedStrokes();
              break;
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (shouldReconnect) {
          reconnectTimeout = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      shouldReconnect = false;
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, [pageId, addSavedStrokes, removeSavedStroke, clearSavedStrokes]);
}

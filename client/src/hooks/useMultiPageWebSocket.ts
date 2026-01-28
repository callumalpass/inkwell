import { useEffect, useRef } from "react";
import { usePageStore } from "../stores/page-store";

export function useMultiPageWebSocket(pageIds: string[]) {
  const wsMapRef = useRef<Map<string, WebSocket>>(new Map());
  const addSavedStrokes = usePageStore((s) => s.addSavedStrokes);
  const removeSavedStroke = usePageStore((s) => s.removeSavedStroke);
  const clearSavedStrokes = usePageStore((s) => s.clearSavedStrokes);

  useEffect(() => {
    const wsMap = wsMapRef.current;
    const desired = new Set(pageIds);
    const shouldReconnect = new Map<string, boolean>();

    // Close connections for pages no longer needed
    for (const [pid, ws] of wsMap) {
      if (!desired.has(pid)) {
        ws.close();
        wsMap.delete(pid);
      }
    }

    // Open connections for new pages
    for (const pid of pageIds) {
      if (wsMap.has(pid)) continue;

      shouldReconnect.set(pid, true);

      function connect(pageId: string) {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(
          `${protocol}//${window.location.host}/ws/page/${pageId}`,
        );
        wsMap.set(pageId, ws);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
              case "strokes:added":
                addSavedStrokes(pageId, msg.strokes);
                break;
              case "strokes:deleted":
                removeSavedStroke(pageId, msg.strokeId);
                break;
              case "strokes:cleared":
                clearSavedStrokes(pageId);
                break;
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => {
          wsMap.delete(pageId);
          if (shouldReconnect.get(pageId)) {
            setTimeout(() => connect(pageId), 2000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      }

      connect(pid);
    }

    return () => {
      for (const [pid] of shouldReconnect) {
        shouldReconnect.set(pid, false);
      }
      for (const [, ws] of wsMap) {
        ws.close();
      }
      wsMap.clear();
    };
  }, [pageIds.join(","), addSavedStrokes, removeSavedStroke, clearSavedStrokes]);
}

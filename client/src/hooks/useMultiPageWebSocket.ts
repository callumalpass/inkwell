import { useEffect, useRef } from "react";
import { usePageStore } from "../stores/page-store";
import { useTranscriptionStore } from "../stores/transcription-store";
import { showSuccess, showError } from "../stores/toast-store";

export function useMultiPageWebSocket(pageIds: string[]) {
  const wsMapRef = useRef<Map<string, WebSocket>>(new Map());
  const addSavedStrokes = usePageStore((s) => s.addSavedStrokes);
  const removeSavedStroke = usePageStore((s) => s.removeSavedStroke);
  const clearSavedStrokes = usePageStore((s) => s.clearSavedStrokes);
  const updateTranscriptionStatus = useTranscriptionStore((s) => s.updateStatus);

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
    const retryCount = new Map<string, number>();

    for (const pid of pageIds) {
      if (wsMap.has(pid)) continue;

      shouldReconnect.set(pid, true);
      retryCount.set(pid, 0);

      function connect(pageId: string) {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(
          `${protocol}//${window.location.host}/ws/page/${pageId}`,
        );
        wsMap.set(pageId, ws);

        ws.onopen = () => {
          // Reset retry count on successful connection
          retryCount.set(pageId, 0);
        };

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
              case "transcription:complete":
                updateTranscriptionStatus(pageId, "complete", msg.content);
                showSuccess("Transcription complete");
                break;
              case "transcription:failed":
                updateTranscriptionStatus(pageId, "failed", undefined, msg.error);
                showError(`Transcription failed: ${msg.error || "Unknown error"}`);
                break;
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => {
          wsMap.delete(pageId);
          if (shouldReconnect.get(pageId)) {
            const attempt = retryCount.get(pageId) ?? 0;
            // Exponential backoff: 1s, 2s, 4s, 8s, capped at 30s
            const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
            retryCount.set(pageId, attempt + 1);
            setTimeout(() => connect(pageId), delay);
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
  }, [pageIds.join(","), addSavedStrokes, removeSavedStroke, clearSavedStrokes, updateTranscriptionStatus]);
}

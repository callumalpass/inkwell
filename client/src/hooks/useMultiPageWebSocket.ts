import { useEffect, useRef, useMemo } from "react";
import { usePageStore } from "../stores/page-store";
import { useTranscriptionStore } from "../stores/transcription-store";
import { useSyncStore } from "../stores/sync-store";
import { showSuccess, showError } from "../stores/toast-store";

export function useMultiPageWebSocket(pageIds: string[]) {
  const wsMapRef = useRef<Map<string, WebSocket>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const addSavedStrokes = usePageStore((s) => s.addSavedStrokes);
  const removeSavedStroke = usePageStore((s) => s.removeSavedStroke);
  const clearSavedStrokes = usePageStore((s) => s.clearSavedStrokes);
  const updateTranscriptionStatus = useTranscriptionStore((s) => s.updateStatus);
  const setWsConnected = useSyncStore((s) => s.setWsConnected);
  const startWsReconnect = useSyncStore((s) => s.startWsReconnect);
  const endWsReconnect = useSyncStore((s) => s.endWsReconnect);

  // Memoize the page IDs to prevent unnecessary effect runs
  const pageIdsKey = useMemo(() => pageIds.join(","), [pageIds]);

  useEffect(() => {
    const wsMap = wsMapRef.current;
    const timers = timersRef.current;
    const desired = new Set(pageIds);
    const shouldReconnect = new Map<string, boolean>();

    // Close connections for pages no longer needed
    for (const [pid, ws] of wsMap) {
      if (!desired.has(pid)) {
        // Clear any pending reconnect timer
        const timer = timers.get(pid);
        if (timer) {
          clearTimeout(timer);
          timers.delete(pid);
        }
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
          setWsConnected(true);
          endWsReconnect();
        };

        ws.onmessage = (event) => {
          let msg: unknown;
          try {
            msg = JSON.parse(event.data);
          } catch (parseError) {
            // Log JSON parse errors - these indicate protocol issues
            console.error(
              `[WebSocket] Failed to parse message for page ${pageId}:`,
              parseError instanceof Error ? parseError.message : parseError,
            );
            return;
          }

          try {
            const typedMsg = msg as { type?: string; strokes?: unknown; strokeId?: string; content?: string; error?: string };
            switch (typedMsg.type) {
              case "strokes:added":
                addSavedStrokes(pageId, typedMsg.strokes as import("../api/strokes").Stroke[]);
                break;
              case "strokes:deleted":
                removeSavedStroke(pageId, typedMsg.strokeId!);
                break;
              case "strokes:cleared":
                clearSavedStrokes(pageId);
                break;
              case "transcription:complete":
                updateTranscriptionStatus(pageId, "complete", typedMsg.content);
                showSuccess("Transcription complete");
                break;
              case "transcription:failed":
                updateTranscriptionStatus(pageId, "failed", undefined, typedMsg.error);
                showError(`Transcription failed: ${typedMsg.error || "Unknown error"}`);
                break;
              default:
                // Unknown message type - log for debugging
                console.warn(`[WebSocket] Unknown message type for page ${pageId}:`, typedMsg.type);
            }
          } catch (handlerError) {
            // Log handler errors - these indicate bugs in our message handling
            console.error(
              `[WebSocket] Error handling message for page ${pageId}:`,
              handlerError instanceof Error ? handlerError.message : handlerError,
            );
          }
        };

        ws.onclose = () => {
          wsMap.delete(pageId);
          setWsConnected(false);
          if (shouldReconnect.get(pageId)) {
            const attempt = retryCount.get(pageId) ?? 0;
            // Exponential backoff: 1s, 2s, 4s, 8s, capped at 30s
            const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
            retryCount.set(pageId, attempt + 1);
            startWsReconnect();
            // Track the timer so we can clear it on cleanup
            const timer = setTimeout(() => {
              timers.delete(pageId);
              connect(pageId);
            }, delay);
            timers.set(pageId, timer);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      }

      connect(pid);
    }

    return () => {
      // Mark all pages as not needing reconnection
      for (const [pid] of shouldReconnect) {
        shouldReconnect.set(pid, false);
      }
      // Clear all pending reconnect timers
      for (const [, timer] of timers) {
        clearTimeout(timer);
      }
      timers.clear();
      // Close all WebSocket connections
      for (const [, ws] of wsMap) {
        ws.close();
      }
      wsMap.clear();
    };
  }, [pageIdsKey, addSavedStrokes, removeSavedStroke, clearSavedStrokes, updateTranscriptionStatus, setWsConnected, startWsReconnect, endWsReconnect]);
}

import { useEffect, useRef } from "react";
import { useDrawingStore } from "../stores/drawing-store";
import { usePageStore } from "../stores/page-store";
import { postStrokes } from "../api/strokes";
import { BATCH_SAVE_INTERVAL_MS } from "../lib/constants";

export function useBatchSave(pageId?: string) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      const store = useDrawingStore.getState();
      const pageStore = usePageStore.getState();

      if (pageId) {
        const pending = store.flushPendingForPage(pageId);
        if (pending.length === 0) return;

        try {
          await postStrokes(pageId, pending);
          pageStore.addSavedStrokes(pageId, pending);
        } catch (err) {
          console.error("Failed to save strokes:", err);
          const current = useDrawingStore.getState();
          const existing = current.pendingStrokesByPage[pageId] ?? [];
          useDrawingStore.setState({
            pendingStrokesByPage: {
              ...current.pendingStrokesByPage,
              [pageId]: [...pending, ...existing],
            },
          });
        }
      } else {
        const allPending = store.flushAllPending();
        const pageIds = Object.keys(allPending);
        if (pageIds.length === 0) return;

        await Promise.all(
          pageIds.map(async (pid) => {
            const pending = allPending[pid];
            if (!pending || pending.length === 0) return;

            try {
              await postStrokes(pid, pending);
              pageStore.addSavedStrokes(pid, pending);
            } catch (err) {
              console.error(`Failed to save strokes for page ${pid}:`, err);
              const current = useDrawingStore.getState();
              const existing = current.pendingStrokesByPage[pid] ?? [];
              useDrawingStore.setState({
                pendingStrokesByPage: {
                  ...current.pendingStrokesByPage,
                  [pid]: [...pending, ...existing],
                },
              });
            }
          }),
        );
      }
    }, BATCH_SAVE_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [pageId]);
}

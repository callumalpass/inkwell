import { useEffect, useRef } from "react";
import { useDrawingStore } from "../stores/drawing-store";
import { usePageStore } from "../stores/page-store";
import { useUndoRedoStore } from "../stores/undo-redo-store";
import { postStrokes } from "../api/strokes";
import { enqueueStrokes } from "../lib/offline-queue";
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
          // Record undo commands for each newly saved stroke
          const undoStore = useUndoRedoStore.getState();
          for (const stroke of pending) {
            undoStore.record({ type: "add-stroke", pageId, stroke });
          }
        } catch {
          // Network failure — persist to IndexedDB for later sync
          await enqueueStrokes(pageId, pending).catch((err) =>
            console.error("Failed to enqueue strokes offline:", err),
          );
          // Still add to page store so the user sees their strokes
          pageStore.addSavedStrokes(pageId, pending);
          const undoStore = useUndoRedoStore.getState();
          for (const stroke of pending) {
            undoStore.record({ type: "add-stroke", pageId, stroke });
          }
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
              const undoStore = useUndoRedoStore.getState();
              for (const stroke of pending) {
                undoStore.record({ type: "add-stroke", pageId: pid, stroke });
              }
            } catch {
              await enqueueStrokes(pid, pending).catch((err) =>
                console.error(`Failed to enqueue strokes offline for ${pid}:`, err),
              );
              pageStore.addSavedStrokes(pid, pending);
              const undoStore = useUndoRedoStore.getState();
              for (const stroke of pending) {
                undoStore.record({ type: "add-stroke", pageId: pid, stroke });
              }
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

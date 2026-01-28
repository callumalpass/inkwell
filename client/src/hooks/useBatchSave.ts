import { useEffect, useRef } from "react";
import { useDrawingStore } from "../stores/drawing-store";
import { usePageStore } from "../stores/page-store";
import { useUndoRedoStore } from "../stores/undo-redo-store";
import { postStrokes } from "../api/strokes";
import { enqueueStrokes } from "../lib/offline-queue";
import { BATCH_SAVE_INTERVAL_MS } from "../lib/constants";
import type { Stroke } from "../api/strokes";

async function saveStrokes(pid: string, strokes: Stroke[]) {
  const pageStore = usePageStore.getState();
  const undoStore = useUndoRedoStore.getState();

  // Optimistically add to page store and record undo before the network call
  // so strokes are never absent from both pending and saved state.
  pageStore.addSavedStrokes(pid, strokes);
  for (const stroke of strokes) {
    undoStore.record({ type: "add-stroke", pageId: pid, stroke });
  }

  try {
    await postStrokes(pid, strokes);
  } catch {
    // Network failure — persist to IndexedDB for later sync
    await enqueueStrokes(pid, strokes).catch((err) =>
      console.error(`Failed to enqueue strokes offline for ${pid}:`, err),
    );
  }
}

export function useBatchSave(pageId?: string) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      const store = useDrawingStore.getState();

      if (pageId) {
        const pending = store.flushPendingForPage(pageId);
        if (pending.length === 0) return;
        await saveStrokes(pageId, pending);
      } else {
        const allPending = store.flushAllPending();
        const pageIds = Object.keys(allPending);
        if (pageIds.length === 0) return;

        await Promise.all(
          pageIds.map(async (pid) => {
            const pending = allPending[pid];
            if (!pending || pending.length === 0) return;
            await saveStrokes(pid, pending);
          }),
        );
      }
    }, BATCH_SAVE_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [pageId]);
}

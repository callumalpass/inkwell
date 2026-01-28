import { useEffect, useRef } from "react";
import { useDrawingStore } from "../stores/drawing-store";
import { usePageStore, trackSave } from "../stores/page-store";
import { useUndoRedoStore } from "../stores/undo-redo-store";
import { postStrokes } from "../api/strokes";
import { enqueueStrokes } from "../lib/offline-queue";
import { BATCH_SAVE_INTERVAL_MS } from "../lib/constants";
import type { Stroke } from "../api/strokes";

function saveStrokes(pid: string, strokes: Stroke[]) {
  const pageStore = usePageStore.getState();
  const undoStore = useUndoRedoStore.getState();

  // Optimistically add to page store and record undo before the network call
  // so strokes are never absent from both pending and saved state.
  pageStore.addSavedStrokes(pid, strokes);
  for (const stroke of strokes) {
    undoStore.record({ type: "add-stroke", pageId: pid, stroke });
  }

  const savePromise = postStrokes(pid, strokes).catch(async () => {
    // Network failure — persist to IndexedDB for later sync
    await enqueueStrokes(pid, strokes).catch((err) =>
      console.error(`Failed to enqueue strokes offline for ${pid}:`, err),
    );
  });
  // Register so loadPageStrokes waits for the server to have this data.
  trackSave(pid, savePromise);
}

function flushAndSave(pageId?: string) {
  const store = useDrawingStore.getState();

  if (pageId) {
    const pending = store.flushPendingForPage(pageId);
    if (pending.length === 0) return;
    saveStrokes(pageId, pending);
  } else {
    const allPending = store.flushAllPending();
    for (const pid of Object.keys(allPending)) {
      const pending = allPending[pid];
      if (!pending || pending.length === 0) continue;
      saveStrokes(pid, pending);
    }
  }
}

export function useBatchSave(pageId?: string) {
  const pageIdRef = useRef(pageId);
  pageIdRef.current = pageId;

  useEffect(() => {
    const interval = setInterval(() => flushAndSave(pageIdRef.current), BATCH_SAVE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      // Flush any remaining pending strokes so nothing is lost on unmount
      flushAndSave(pageIdRef.current);
    };
  }, [pageId]);
}

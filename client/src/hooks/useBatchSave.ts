import { useEffect, useRef } from "react";
import { useDrawingStore } from "../stores/drawing-store";
import { usePageStore } from "../stores/page-store";
import { postStrokes } from "../api/strokes";
import { BATCH_SAVE_INTERVAL_MS } from "../lib/constants";

export function useBatchSave(pageId: string | undefined) {
  const flushPending = useDrawingStore((s) => s.flushPending);
  const addSavedStrokes = usePageStore((s) => s.addSavedStrokes);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!pageId) return;

    intervalRef.current = setInterval(async () => {
      const pending = flushPending();
      if (pending.length === 0) return;

      try {
        await postStrokes(pageId, pending);
        addSavedStrokes(pending);
      } catch (err) {
        console.error("Failed to save strokes:", err);
        // Put them back as pending so they retry
        const store = useDrawingStore.getState();
        useDrawingStore.setState({
          pendingStrokes: [...pending, ...store.pendingStrokes],
        });
      }
    }, BATCH_SAVE_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [pageId, flushPending, addSavedStrokes]);
}

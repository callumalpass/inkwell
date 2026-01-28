import { useEffect, useRef } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import {
  peekAllPending,
  removePendingEntry,
} from "../lib/offline-queue";
import { postStrokes } from "../api/strokes";
import { usePageStore } from "../stores/page-store";

const SYNC_INTERVAL_MS = 5000;

/**
 * Drains the IndexedDB offline stroke queue whenever the browser is online.
 * Runs on a fixed interval and also triggers immediately when coming back online.
 */
export function useOfflineSync() {
  const online = useNetworkStatus();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!online) return;

    async function drain() {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const entries = await peekAllPending();
        for (const entry of entries) {
          if (!navigator.onLine) break;
          try {
            await postStrokes(entry.pageId, entry.strokes);
            // Also add to page store so they render without a reload
            usePageStore.getState().addSavedStrokes(entry.pageId, entry.strokes);
            await removePendingEntry(entry.id!);
          } catch {
            // Still offline or server error — stop and retry later
            break;
          }
        }
      } finally {
        syncingRef.current = false;
      }
    }

    // Drain immediately when coming online
    drain();

    const id = setInterval(drain, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [online]);
}

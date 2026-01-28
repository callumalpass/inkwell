import { useEffect, useRef } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import {
  peekAllPending,
  removePendingEntry,
  purgeStaleEntries,
} from "../lib/offline-queue";
import { postStrokes } from "../api/strokes";
import { ApiError } from "../api/client";
import { usePageStore } from "../stores/page-store";

const BASE_SYNC_INTERVAL_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;
/** Purge stale entries once per session on first drain. */
const PURGE_ON_FIRST_DRAIN = true;

/**
 * Drains the IndexedDB offline stroke queue whenever the browser is online.
 * Uses exponential backoff on transient errors and stops retrying permanently
 * failed entries (4xx client errors).
 */
export function useOfflineSync() {
  const online = useNetworkStatus();
  const syncingRef = useRef(false);
  const backoffRef = useRef(0);
  const hasPurgedRef = useRef(false);

  useEffect(() => {
    if (!online) {
      // Reset backoff when going offline so we try immediately on reconnect
      backoffRef.current = 0;
      return;
    }

    async function drain() {
      if (syncingRef.current) return;
      syncingRef.current = true;

      try {
        // Purge stale entries on first drain of the session
        if (PURGE_ON_FIRST_DRAIN && !hasPurgedRef.current) {
          hasPurgedRef.current = true;
          const purged = await purgeStaleEntries();
          if (purged > 0) {
            console.info(`Purged ${purged} stale offline queue entries`);
          }
        }

        const entries = await peekAllPending();
        if (entries.length === 0) {
          backoffRef.current = 0;
          return;
        }

        for (const entry of entries) {
          if (!navigator.onLine) break;
          try {
            await postStrokes(entry.pageId, entry.strokes);
            // Also add to page store so they render without a reload
            usePageStore.getState().addSavedStrokes(entry.pageId, entry.strokes);
            await removePendingEntry(entry.id!);
            // Successful sync resets backoff
            backoffRef.current = 0;
          } catch (err) {
            if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
              // Client error (e.g. page deleted) — discard entry, it won't succeed on retry
              console.warn(
                `Discarding offline entry for page ${entry.pageId}: ${err.status} ${err.message}`,
              );
              await removePendingEntry(entry.id!);
              continue;
            }
            // Transient error — apply backoff and stop processing
            backoffRef.current = Math.min(
              MAX_BACKOFF_MS,
              backoffRef.current === 0 ? BASE_SYNC_INTERVAL_MS : backoffRef.current * 2,
            );
            break;
          }
        }
      } finally {
        syncingRef.current = false;
      }
    }

    // Drain immediately when coming online
    drain();

    const id = setInterval(drain, BASE_SYNC_INTERVAL_MS + backoffRef.current);
    return () => clearInterval(id);
  }, [online]);
}

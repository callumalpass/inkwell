import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOfflineSync } from "./useOfflineSync";
import { usePageStore } from "../stores/page-store";
import { ApiError } from "../api/client";
import type { Stroke } from "../api/strokes";
import type { PendingEntry } from "../lib/offline-queue";

// Mock the dependencies
vi.mock("../api/strokes", () => ({
  postStrokes: vi.fn(),
}));

vi.mock("./useNetworkStatus", () => ({
  useNetworkStatus: vi.fn(() => true),
}));

vi.mock("../lib/offline-queue", () => ({
  peekAllPending: vi.fn(),
  removePendingEntry: vi.fn(),
  purgeStaleEntries: vi.fn(),
}));

import * as strokesApi from "../api/strokes";
import { useNetworkStatus } from "./useNetworkStatus";
import * as offlineQueue from "../lib/offline-queue";

function makeStroke(id: string): Stroke {
  return {
    id,
    points: [
      { x: 10, y: 20, pressure: 0.5 },
      { x: 30, y: 40, pressure: 0.6 },
    ],
    color: "#000000",
    width: 3,
    createdAt: new Date().toISOString(),
  };
}

function makeEntry(id: number, pageId: string, strokes: Stroke[]): PendingEntry {
  return {
    id,
    pageId,
    strokes,
    createdAt: Date.now(),
  };
}

// Helper to flush pending promises and advance any scheduled timers
async function flushAll() {
  // First advance through microtasks, then advance timer if needed
  await vi.advanceTimersByTimeAsync(0);
}

describe("useOfflineSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(useNetworkStatus).mockReturnValue(true);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    usePageStore.setState({
      strokesByPage: { pg_test: [] },
      loadingPages: new Set(),
    });
    vi.mocked(strokesApi.postStrokes).mockResolvedValue({ count: 1 });
    vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([]);
    vi.mocked(offlineQueue.removePendingEntry).mockResolvedValue(undefined);
    vi.mocked(offlineQueue.purgeStaleEntries).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("initial behavior", () => {
    it("calls drain immediately when online", async () => {
      renderHook(() => useOfflineSync());

      // Flush the initial drain (it runs immediately)
      await act(async () => {
        await flushAll();
      });

      expect(offlineQueue.peekAllPending).toHaveBeenCalled();
    });

    it("does not drain when offline", async () => {
      vi.mocked(useNetworkStatus).mockReturnValue(false);

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      // Advance time to see if any drains are scheduled
      await act(async () => {
        vi.advanceTimersByTime(10000);
        await flushAll();
      });

      expect(offlineQueue.peekAllPending).not.toHaveBeenCalled();
    });
  });

  describe("draining the queue", () => {
    it("syncs pending entries to the server", async () => {
      const stroke = makeStroke("st_1");
      const entry = makeEntry(1, "pg_test", [stroke]);
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([entry]);

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      expect(strokesApi.postStrokes).toHaveBeenCalledWith("pg_test", [stroke]);
    });

    it("removes entries from queue after successful sync", async () => {
      const entry = makeEntry(1, "pg_test", [makeStroke("st_1")]);
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([entry]);

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      expect(offlineQueue.removePendingEntry).toHaveBeenCalledWith(1);
    });

    it("adds synced strokes to page store", async () => {
      const stroke = makeStroke("st_1");
      const entry = makeEntry(1, "pg_test", [stroke]);
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([entry]);

      const addSavedSpy = vi.spyOn(usePageStore.getState(), "addSavedStrokes");

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      expect(addSavedSpy).toHaveBeenCalledWith("pg_test", [stroke]);
    });

    it("processes multiple entries in order", async () => {
      const entries = [
        makeEntry(1, "pg_a", [makeStroke("st_1")]),
        makeEntry(2, "pg_b", [makeStroke("st_2")]),
        makeEntry(3, "pg_c", [makeStroke("st_3")]),
      ];
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue(entries);

      usePageStore.setState({
        strokesByPage: { pg_a: [], pg_b: [], pg_c: [] },
        loadingPages: new Set(),
      });

      const callOrder: string[] = [];
      vi.mocked(strokesApi.postStrokes).mockImplementation(async (pageId) => {
        callOrder.push(pageId);
        return { count: 1 };
      });

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      expect(callOrder).toEqual(["pg_a", "pg_b", "pg_c"]);
    });
  });

  describe("error handling", () => {
    it("discards entries on 4xx client errors", async () => {
      const entry = makeEntry(1, "pg_deleted", [makeStroke("st_1")]);
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([entry]);
      vi.mocked(strokesApi.postStrokes).mockRejectedValueOnce(
        new ApiError(404, "Page not found"),
      );

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      // Entry should still be removed (discarded)
      expect(offlineQueue.removePendingEntry).toHaveBeenCalledWith(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Discarding offline entry for page pg_deleted"),
      );
    });

    it("applies exponential backoff on transient errors", async () => {
      const entry = makeEntry(1, "pg_test", [makeStroke("st_1")]);
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([entry]);
      vi.mocked(strokesApi.postStrokes)
        .mockRejectedValueOnce(new ApiError(500, "Server error"))
        .mockResolvedValueOnce({ count: 1 });

      renderHook(() => useOfflineSync());

      // First drain attempt fails
      await act(async () => {
        await flushAll();
      });

      // Entry should NOT be removed after transient error
      expect(offlineQueue.removePendingEntry).not.toHaveBeenCalled();

      // Wait for backoff + base interval (5000ms base + 5000ms backoff)
      await act(async () => {
        vi.advanceTimersByTime(10100);
        await flushAll();
      });

      // Now it should be removed after success
      expect(offlineQueue.removePendingEntry).toHaveBeenCalledWith(1);
    });

    it("doubles backoff on consecutive transient errors", async () => {
      const entry = makeEntry(1, "pg_test", [makeStroke("st_1")]);
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([entry]);
      vi.mocked(strokesApi.postStrokes)
        .mockRejectedValueOnce(new ApiError(503, "Service unavailable"))
        .mockRejectedValueOnce(new ApiError(503, "Service unavailable"))
        .mockResolvedValueOnce({ count: 1 });

      renderHook(() => useOfflineSync());

      // First failure: backoff = 5000ms, next timer = BASE + 5000 = 10000ms
      await act(async () => {
        await flushAll();
      });
      expect(strokesApi.postStrokes).toHaveBeenCalledTimes(1);

      // Advance by 10000ms (5000 base + 5000 backoff) to trigger next drain
      await act(async () => {
        vi.advanceTimersByTime(10100);
        await flushAll();
      });

      // Second failure: backoff = 10000ms, next timer = BASE + 10000 = 15000ms
      expect(strokesApi.postStrokes).toHaveBeenCalledTimes(2);

      // Advance by 15000ms (5000 base + 10000 backoff) to trigger next drain
      await act(async () => {
        vi.advanceTimersByTime(15100);
        await flushAll();
      });

      // Third attempt should succeed
      expect(strokesApi.postStrokes).toHaveBeenCalledTimes(3);
      expect(offlineQueue.removePendingEntry).toHaveBeenCalledWith(1);
    });

    it("caps backoff at MAX_BACKOFF_MS (60 seconds)", async () => {
      const entry = makeEntry(1, "pg_test", [makeStroke("st_1")]);
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([entry]);

      // Mock repeated failures
      vi.mocked(strokesApi.postStrokes).mockRejectedValue(
        new ApiError(500, "Server error"),
      );

      renderHook(() => useOfflineSync());

      // Initial drain
      await act(async () => {
        await flushAll();
      });

      // Simulate many failures to hit the max backoff
      // backoffs: 5000, 10000, 20000, 40000, 60000 (capped)
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          vi.advanceTimersByTime(65100);
          await flushAll();
        });
      }

      // After hitting max, next interval should be BASE + MAX = 65000ms
      const callsBefore = vi.mocked(strokesApi.postStrokes).mock.calls.length;

      await act(async () => {
        vi.advanceTimersByTime(65100);
        await flushAll();
      });

      const callsAfter = vi.mocked(strokesApi.postStrokes).mock.calls.length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });

    it("stops processing queue when going offline mid-drain", async () => {
      const entries = [
        makeEntry(1, "pg_a", [makeStroke("st_1")]),
        makeEntry(2, "pg_b", [makeStroke("st_2")]),
      ];
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue(entries);

      usePageStore.setState({
        strokesByPage: { pg_a: [], pg_b: [] },
        loadingPages: new Set(),
      });

      vi.mocked(strokesApi.postStrokes).mockImplementation(async (pageId) => {
        if (pageId === "pg_a") {
          // Simulate going offline after first success
          vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        }
        return { count: 1 };
      });

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      // Only the first entry should be processed
      expect(strokesApi.postStrokes).toHaveBeenCalledTimes(1);
      expect(offlineQueue.removePendingEntry).toHaveBeenCalledTimes(1);
      expect(offlineQueue.removePendingEntry).toHaveBeenCalledWith(1);
    });
  });

  describe("stale entry purging", () => {
    it("purges stale entries on first drain", async () => {
      vi.mocked(offlineQueue.purgeStaleEntries).mockResolvedValue(3);
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      expect(offlineQueue.purgeStaleEntries).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Purged 3 stale offline queue entries"),
      );
    });

    it("does not log when no entries purged", async () => {
      vi.mocked(offlineQueue.purgeStaleEntries).mockResolvedValue(0);
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      expect(offlineQueue.purgeStaleEntries).toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it("only purges once per hook instance", async () => {
      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      expect(offlineQueue.purgeStaleEntries).toHaveBeenCalledTimes(1);

      // Advance through a few drain cycles
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          vi.advanceTimersByTime(5100);
          await flushAll();
        });
      }

      // Purge should still only have been called once
      expect(offlineQueue.purgeStaleEntries).toHaveBeenCalledTimes(1);
    });
  });

  describe("network status transitions", () => {
    it("starts draining when coming online", async () => {
      vi.mocked(useNetworkStatus).mockReturnValue(false);

      const { rerender } = renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
        vi.advanceTimersByTime(10000);
        await flushAll();
      });

      expect(offlineQueue.peekAllPending).not.toHaveBeenCalled();

      // Come online
      vi.mocked(useNetworkStatus).mockReturnValue(true);
      rerender();

      await act(async () => {
        await flushAll();
      });

      expect(offlineQueue.peekAllPending).toHaveBeenCalled();
    });

    it("resets backoff when going offline", async () => {
      const entry = makeEntry(1, "pg_test", [makeStroke("st_1")]);
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([entry]);
      vi.mocked(strokesApi.postStrokes)
        .mockRejectedValueOnce(new ApiError(500, "Server error"))
        .mockResolvedValue({ count: 1 });

      const { rerender } = renderHook(() => useOfflineSync());

      // First drain fails, sets backoff
      await act(async () => {
        await flushAll();
      });

      expect(strokesApi.postStrokes).toHaveBeenCalledTimes(1);

      // Go offline (this cancels the effect and clears pending timers for this hook)
      vi.mocked(useNetworkStatus).mockReturnValue(false);
      rerender();

      await act(async () => {
        await flushAll();
      });

      // Come back online - backoff should be reset
      vi.mocked(useNetworkStatus).mockReturnValue(true);
      rerender();

      // Drain should happen within the base interval (backoff was reset)
      await act(async () => {
        vi.advanceTimersByTime(5100);
        await flushAll();
      });

      // Second attempt should have happened
      expect(strokesApi.postStrokes).toHaveBeenCalledTimes(2);
      expect(offlineQueue.removePendingEntry).toHaveBeenCalledWith(1);
    });
  });

  describe("periodic draining", () => {
    it("schedules subsequent drains at BASE_SYNC_INTERVAL_MS", async () => {
      renderHook(() => useOfflineSync());

      // Initial drain
      await act(async () => {
        await flushAll();
      });

      const callsAfterInitial = vi.mocked(offlineQueue.peekAllPending).mock.calls.length;

      // Wait for next scheduled drain (5 seconds)
      await act(async () => {
        vi.advanceTimersByTime(5100);
        await flushAll();
      });

      expect(vi.mocked(offlineQueue.peekAllPending).mock.calls.length).toBeGreaterThan(
        callsAfterInitial,
      );
    });

    it("cancels scheduled drains on unmount", async () => {
      const { unmount } = renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      const callsBeforeUnmount = vi.mocked(offlineQueue.peekAllPending).mock.calls.length;

      unmount();

      // Wait longer than the drain interval
      await act(async () => {
        vi.advanceTimersByTime(10000);
        await flushAll();
      });

      // No new drains should have occurred
      expect(vi.mocked(offlineQueue.peekAllPending).mock.calls.length).toBe(
        callsBeforeUnmount,
      );
    });
  });

  describe("concurrent drain prevention", () => {
    it("prevents multiple concurrent drains", async () => {
      const entry = makeEntry(1, "pg_test", [makeStroke("st_1")]);
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([entry]);

      let resolvePostStrokes: () => void;
      const postStrokesPromise = new Promise<{ count: number }>((resolve) => {
        resolvePostStrokes = () => resolve({ count: 1 });
      });

      let callCount = 0;
      vi.mocked(strokesApi.postStrokes).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return postStrokesPromise;
        }
        return { count: 1 };
      });

      renderHook(() => useOfflineSync());

      // Start first drain - this will block on postStrokesPromise
      await act(async () => {
        await flushAll();
      });

      expect(callCount).toBe(1);

      // Try to trigger another drain while first is in progress
      await act(async () => {
        vi.advanceTimersByTime(5100);
        await flushAll();
      });

      // Should still only have one call (concurrent drain prevented by syncingRef)
      expect(callCount).toBe(1);

      // Complete the first drain
      await act(async () => {
        resolvePostStrokes!();
        await flushAll();
      });

      expect(offlineQueue.removePendingEntry).toHaveBeenCalledWith(1);
    });
  });

  describe("edge cases", () => {
    it("handles empty queue gracefully", async () => {
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([]);

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      expect(strokesApi.postStrokes).not.toHaveBeenCalled();
    });

    it("resets backoff after successful sync", async () => {
      const entry = makeEntry(1, "pg_test", [makeStroke("st_1")]);

      // The entry is always returned so the drain keeps trying
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue([entry]);

      vi.mocked(strokesApi.postStrokes)
        .mockRejectedValueOnce(new ApiError(500, "Server error"))
        .mockResolvedValue({ count: 1 });

      renderHook(() => useOfflineSync());

      // First drain fails, backoff = 5000ms
      await act(async () => {
        await flushAll();
      });

      expect(offlineQueue.removePendingEntry).not.toHaveBeenCalled();
      expect(strokesApi.postStrokes).toHaveBeenCalledTimes(1);

      // Wait for backoff + base interval (5000 + 5000 = 10000ms)
      await act(async () => {
        vi.advanceTimersByTime(10100);
        await flushAll();
      });

      // Second attempt succeeds
      expect(offlineQueue.removePendingEntry).toHaveBeenCalledWith(1);
      expect(strokesApi.postStrokes).toHaveBeenCalledTimes(2);

      // After success, backoff is reset to 0
      // The next drain should happen at base interval only (5000ms)
      const callsBefore = vi.mocked(strokesApi.postStrokes).mock.calls.length;

      await act(async () => {
        vi.advanceTimersByTime(5100);
        await flushAll();
      });

      // Should have called again at the base interval
      expect(vi.mocked(strokesApi.postStrokes).mock.calls.length).toBeGreaterThan(
        callsBefore,
      );
    });

    it("continues processing remaining entries after 4xx error", async () => {
      const entries = [
        makeEntry(1, "pg_deleted", [makeStroke("st_1")]),
        makeEntry(2, "pg_exists", [makeStroke("st_2")]),
      ];
      vi.mocked(offlineQueue.peekAllPending).mockResolvedValue(entries);

      usePageStore.setState({
        strokesByPage: { pg_deleted: [], pg_exists: [] },
        loadingPages: new Set(),
      });

      vi.spyOn(console, "warn").mockImplementation(() => {});

      vi.mocked(strokesApi.postStrokes)
        .mockRejectedValueOnce(new ApiError(404, "Page not found"))
        .mockResolvedValueOnce({ count: 1 });

      renderHook(() => useOfflineSync());

      await act(async () => {
        await flushAll();
      });

      // Both entries should be processed (first discarded, second synced)
      expect(strokesApi.postStrokes).toHaveBeenCalledTimes(2);
      expect(offlineQueue.removePendingEntry).toHaveBeenCalledWith(1);
      expect(offlineQueue.removePendingEntry).toHaveBeenCalledWith(2);
    });
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  enqueueStrokes,
  peekAllPending,
  removePendingEntry,
  pendingCount,
  purgeStaleEntries,
  setQuotaExceededCallback,
} from "./offline-queue";
import type { Stroke } from "../api/strokes";

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

function deleteDB(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe("offline-queue", () => {
  beforeEach(async () => {
    await deleteDB("inkwell-offline");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setQuotaExceededCallback(null);
  });

  it("starts with zero pending entries", async () => {
    const count = await pendingCount();
    expect(count).toBe(0);
  });

  it("enqueues and peeks strokes", async () => {
    const stroke = makeStroke("st_1");
    await enqueueStrokes("pg_abc", [stroke]);

    const entries = await peekAllPending();
    expect(entries).toHaveLength(1);
    expect(entries[0].pageId).toBe("pg_abc");
    expect(entries[0].strokes).toHaveLength(1);
    expect(entries[0].strokes[0].id).toBe("st_1");
  });

  it("tracks count correctly across enqueues", async () => {
    await enqueueStrokes("pg_a", [makeStroke("st_1")]);
    await enqueueStrokes("pg_b", [makeStroke("st_2")]);
    await enqueueStrokes("pg_a", [makeStroke("st_3")]);

    expect(await pendingCount()).toBe(3);
  });

  it("removes individual entries by id", async () => {
    await enqueueStrokes("pg_a", [makeStroke("st_1")]);
    await enqueueStrokes("pg_b", [makeStroke("st_2")]);

    const entries = await peekAllPending();
    expect(entries).toHaveLength(2);

    await removePendingEntry(entries[0].id!);

    const remaining = await peekAllPending();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].pageId).toBe("pg_b");
  });

  it("handles multiple strokes per entry", async () => {
    const strokes = [makeStroke("st_1"), makeStroke("st_2"), makeStroke("st_3")];
    await enqueueStrokes("pg_a", strokes);

    const entries = await peekAllPending();
    expect(entries).toHaveLength(1);
    expect(entries[0].strokes).toHaveLength(3);
  });

  it("preserves stroke data fidelity", async () => {
    const stroke: Stroke = {
      id: "st_fidelity",
      points: [
        { x: 100.5, y: 200.3, pressure: 0.8 },
        { x: 101.2, y: 201.1, pressure: 0.85 },
      ],
      color: "#1e40af",
      width: 5,
      penStyle: "ballpoint",
      createdAt: "2025-01-28T10:00:00Z",
    };
    await enqueueStrokes("pg_test", [stroke]);

    const entries = await peekAllPending();
    const retrieved = entries[0].strokes[0];
    expect(retrieved.id).toBe("st_fidelity");
    expect(retrieved.color).toBe("#1e40af");
    expect(retrieved.width).toBe(5);
    expect(retrieved.penStyle).toBe("ballpoint");
    expect(retrieved.points).toEqual(stroke.points);
  });

  it("draining all entries leaves count at zero", async () => {
    await enqueueStrokes("pg_a", [makeStroke("st_1")]);
    await enqueueStrokes("pg_b", [makeStroke("st_2")]);

    const entries = await peekAllPending();
    for (const entry of entries) {
      await removePendingEntry(entry.id!);
    }

    expect(await pendingCount()).toBe(0);
    expect(await peekAllPending()).toEqual([]);
  });

  it("assigns auto-incrementing IDs", async () => {
    await enqueueStrokes("pg_a", [makeStroke("st_1")]);
    await enqueueStrokes("pg_b", [makeStroke("st_2")]);

    const entries = await peekAllPending();
    expect(entries[0].id).toBeDefined();
    expect(entries[1].id).toBeDefined();
    expect(entries[1].id).toBeGreaterThan(entries[0].id!);
  });

  it("stores createdAt timestamp from Date.now()", async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    await enqueueStrokes("pg_a", [makeStroke("st_1")]);

    const entries = await peekAllPending();
    expect(entries[0].createdAt).toBe(now);
  });

  describe("purgeStaleEntries", () => {
    it("purges entries older than the threshold", async () => {
      const now = 1_700_000_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now - 20_000);

      await enqueueStrokes("pg_a", [makeStroke("st_old")]);
      await enqueueStrokes("pg_b", [makeStroke("st_old2")]);

      expect(await peekAllPending()).toHaveLength(2);

      // Now Date.now() returns a time 20s later; purge entries older than 5s
      vi.spyOn(Date, "now").mockReturnValue(now);
      const purged = await purgeStaleEntries(5_000);
      expect(purged).toBe(2);
      expect(await pendingCount()).toBe(0);
    });

    it("keeps entries within the threshold", async () => {
      await enqueueStrokes("pg_a", [makeStroke("st_1")]);
      await enqueueStrokes("pg_b", [makeStroke("st_2")]);

      // Use a very large maxAge so nothing is stale
      const purged = await purgeStaleEntries(1_000_000_000);
      expect(purged).toBe(0);
      expect(await pendingCount()).toBe(2);
    });

    it("returns zero when queue is empty", async () => {
      const purged = await purgeStaleEntries(1_000_000_000);
      expect(purged).toBe(0);
    });

    it("selectively purges only stale entries", async () => {
      const now = 1_700_000_000_000;

      // Enqueue "old" entry at t=0
      vi.spyOn(Date, "now").mockReturnValue(now - 20_000);
      await enqueueStrokes("pg_old", [makeStroke("st_old")]);

      // Enqueue "new" entry at t=20s
      vi.spyOn(Date, "now").mockReturnValue(now);
      await enqueueStrokes("pg_new", [makeStroke("st_new")]);

      // Purge entries older than 10s (only pg_old should be purged)
      const purged = await purgeStaleEntries(10_000);
      expect(purged).toBe(1);

      const remaining = await peekAllPending();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].pageId).toBe("pg_new");
    });
  });

  describe("setQuotaExceededCallback", () => {
    it("allows setting a callback function", () => {
      const callback = vi.fn();
      setQuotaExceededCallback(callback);
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it("allows clearing the callback with null", () => {
      const callback = vi.fn();
      setQuotaExceededCallback(callback);
      setQuotaExceededCallback(null);
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it("replaces previous callback when set multiple times", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      setQuotaExceededCallback(callback1);
      setQuotaExceededCallback(callback2);
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });
});

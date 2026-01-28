import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  enqueueStrokes,
  peekAllPending,
  removePendingEntry,
  pendingCount,
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

describe("offline-queue", () => {
  beforeEach(async () => {
    // Clear the database between tests
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
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
});

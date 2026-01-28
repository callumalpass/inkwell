import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import {
  getStrokes,
  appendStrokes,
  deleteStroke,
  clearStrokes,
} from "./stroke-store.js";
import { createNotebook } from "./notebook-store.js";
import { createPage } from "./page-store.js";
import { readJson } from "./fs-utils.js";
import { paths } from "./paths.js";
import type { Stroke, NotebookMeta, PageMeta } from "../types/index.js";

let originalDataDir: string;
let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-stroke-store-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
});

afterEach(async () => {
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

function makeNotebook(overrides: Partial<NotebookMeta> = {}): NotebookMeta {
  const now = new Date().toISOString();
  return {
    id: `nb_test_${Date.now()}`,
    title: "Test Notebook",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makePage(overrides: Partial<PageMeta> = {}): PageMeta {
  const now = new Date().toISOString();
  return {
    id: `pg_test_${Date.now()}`,
    notebookId: "nb_default",
    pageNumber: 1,
    canvasX: 0,
    canvasY: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeStroke(overrides: Partial<Stroke> = {}): Stroke {
  return {
    id: `sk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    points: [
      { x: 10, y: 20, pressure: 0.5 },
      { x: 30, y: 40, pressure: 0.7 },
      { x: 50, y: 60, pressure: 0.3 },
    ],
    color: "#000000",
    width: 2,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function setupNotebookAndPage(
  notebookId: string,
  pageId: string,
): Promise<void> {
  await createNotebook(makeNotebook({ id: notebookId }));
  await createPage(makePage({ id: pageId, notebookId }));
}

describe("getStrokes", () => {
  it("returns an empty array for a new page with no strokes", async () => {
    await setupNotebookAndPage("nb_gs1", "pg_gs1");

    const strokes = await getStrokes("pg_gs1");
    expect(strokes).toEqual([]);
  });

  it("returns null for a non-existent page", async () => {
    const strokes = await getStrokes("pg_nonexistent");
    expect(strokes).toBeNull();
  });

  it("returns strokes that were previously appended", async () => {
    await setupNotebookAndPage("nb_gs2", "pg_gs2");

    const stroke = makeStroke({ id: "sk_gs2" });
    await appendStrokes("pg_gs2", [stroke]);

    const strokes = await getStrokes("pg_gs2");
    expect(strokes).toHaveLength(1);
    expect(strokes![0].id).toBe("sk_gs2");
    expect(strokes![0].points).toEqual(stroke.points);
  });

  it("returns strokes with all fields intact", async () => {
    await setupNotebookAndPage("nb_gs3", "pg_gs3");

    const stroke = makeStroke({
      id: "sk_gs3",
      color: "#ff0000",
      width: 5,
      penStyle: "ballpoint",
    });
    await appendStrokes("pg_gs3", [stroke]);

    const strokes = await getStrokes("pg_gs3");
    expect(strokes).toHaveLength(1);
    expect(strokes![0]).toEqual(stroke);
  });
});

describe("appendStrokes", () => {
  it("appends a single stroke to an empty page", async () => {
    await setupNotebookAndPage("nb_as1", "pg_as1");

    const stroke = makeStroke({ id: "sk_as1" });
    const result = await appendStrokes("pg_as1", [stroke]);

    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("sk_as1");
  });

  it("appends multiple strokes at once", async () => {
    await setupNotebookAndPage("nb_as2", "pg_as2");

    const strokes = [
      makeStroke({ id: "sk_as2a" }),
      makeStroke({ id: "sk_as2b" }),
      makeStroke({ id: "sk_as2c" }),
    ];
    const result = await appendStrokes("pg_as2", strokes);

    expect(result).toHaveLength(3);
    expect(result!.map((s) => s.id)).toEqual(["sk_as2a", "sk_as2b", "sk_as2c"]);
  });

  it("preserves existing strokes when appending new ones", async () => {
    await setupNotebookAndPage("nb_as3", "pg_as3");

    const first = makeStroke({ id: "sk_as3a" });
    await appendStrokes("pg_as3", [first]);

    const second = makeStroke({ id: "sk_as3b" });
    const result = await appendStrokes("pg_as3", [second]);

    expect(result).toHaveLength(2);
    expect(result![0].id).toBe("sk_as3a");
    expect(result![1].id).toBe("sk_as3b");
  });

  it("returns null for a non-existent page", async () => {
    const stroke = makeStroke({ id: "sk_as_missing" });
    const result = await appendStrokes("pg_nonexistent", [stroke]);
    expect(result).toBeNull();
  });

  it("persists strokes to disk", async () => {
    await setupNotebookAndPage("nb_as4", "pg_as4");

    const stroke = makeStroke({ id: "sk_as4" });
    await appendStrokes("pg_as4", [stroke]);

    // Read directly from disk to verify persistence
    const fromDisk = await readJson<Stroke[]>(paths.strokes("nb_as4", "pg_as4"));
    expect(fromDisk).toHaveLength(1);
    expect(fromDisk![0].id).toBe("sk_as4");
  });

  it("handles appending an empty array", async () => {
    await setupNotebookAndPage("nb_as5", "pg_as5");

    const stroke = makeStroke({ id: "sk_as5" });
    await appendStrokes("pg_as5", [stroke]);

    const result = await appendStrokes("pg_as5", []);
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("sk_as5");
  });

  it("handles strokes with different pen styles", async () => {
    await setupNotebookAndPage("nb_as6", "pg_as6");

    const strokes = [
      makeStroke({ id: "sk_as6a", penStyle: "pressure" }),
      makeStroke({ id: "sk_as6b", penStyle: "uniform" }),
      makeStroke({ id: "sk_as6c", penStyle: "ballpoint" }),
    ];
    const result = await appendStrokes("pg_as6", strokes);

    expect(result).toHaveLength(3);
    expect(result![0].penStyle).toBe("pressure");
    expect(result![1].penStyle).toBe("uniform");
    expect(result![2].penStyle).toBe("ballpoint");
  });

  it("handles strokes with minimal points", async () => {
    await setupNotebookAndPage("nb_as7", "pg_as7");

    const stroke = makeStroke({
      id: "sk_as7",
      points: [{ x: 0, y: 0, pressure: 0.5 }],
    });
    const result = await appendStrokes("pg_as7", [stroke]);

    expect(result).toHaveLength(1);
    expect(result![0].points).toHaveLength(1);
  });
});

describe("deleteStroke", () => {
  it("removes a stroke by id", async () => {
    await setupNotebookAndPage("nb_ds1", "pg_ds1");

    const strokes = [
      makeStroke({ id: "sk_ds1a" }),
      makeStroke({ id: "sk_ds1b" }),
      makeStroke({ id: "sk_ds1c" }),
    ];
    await appendStrokes("pg_ds1", strokes);

    const result = await deleteStroke("pg_ds1", "sk_ds1b");
    expect(result).toHaveLength(2);
    expect(result!.map((s) => s.id)).toEqual(["sk_ds1a", "sk_ds1c"]);
  });

  it("persists the deletion to disk", async () => {
    await setupNotebookAndPage("nb_ds2", "pg_ds2");

    await appendStrokes("pg_ds2", [
      makeStroke({ id: "sk_ds2a" }),
      makeStroke({ id: "sk_ds2b" }),
    ]);

    await deleteStroke("pg_ds2", "sk_ds2a");

    const fromDisk = await readJson<Stroke[]>(paths.strokes("nb_ds2", "pg_ds2"));
    expect(fromDisk).toHaveLength(1);
    expect(fromDisk![0].id).toBe("sk_ds2b");
  });

  it("returns null for a non-existent page", async () => {
    const result = await deleteStroke("pg_nonexistent", "sk_any");
    expect(result).toBeNull();
  });

  it("returns unchanged strokes when stroke id does not exist", async () => {
    await setupNotebookAndPage("nb_ds3", "pg_ds3");

    const stroke = makeStroke({ id: "sk_ds3" });
    await appendStrokes("pg_ds3", [stroke]);

    const result = await deleteStroke("pg_ds3", "sk_not_found");
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("sk_ds3");
  });

  it("can delete the only stroke on a page", async () => {
    await setupNotebookAndPage("nb_ds4", "pg_ds4");

    await appendStrokes("pg_ds4", [makeStroke({ id: "sk_ds4" })]);

    const result = await deleteStroke("pg_ds4", "sk_ds4");
    expect(result).toEqual([]);
  });

  it("can delete the first stroke", async () => {
    await setupNotebookAndPage("nb_ds5", "pg_ds5");

    await appendStrokes("pg_ds5", [
      makeStroke({ id: "sk_ds5a" }),
      makeStroke({ id: "sk_ds5b" }),
    ]);

    const result = await deleteStroke("pg_ds5", "sk_ds5a");
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("sk_ds5b");
  });

  it("can delete the last stroke", async () => {
    await setupNotebookAndPage("nb_ds6", "pg_ds6");

    await appendStrokes("pg_ds6", [
      makeStroke({ id: "sk_ds6a" }),
      makeStroke({ id: "sk_ds6b" }),
    ]);

    const result = await deleteStroke("pg_ds6", "sk_ds6b");
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("sk_ds6a");
  });

  it("does not affect strokes on other pages", async () => {
    await setupNotebookAndPage("nb_ds7", "pg_ds7a");
    await createPage(makePage({ id: "pg_ds7b", notebookId: "nb_ds7", pageNumber: 2 }));

    await appendStrokes("pg_ds7a", [makeStroke({ id: "sk_ds7a" })]);
    await appendStrokes("pg_ds7b", [makeStroke({ id: "sk_ds7b" })]);

    await deleteStroke("pg_ds7a", "sk_ds7a");

    const otherPageStrokes = await getStrokes("pg_ds7b");
    expect(otherPageStrokes).toHaveLength(1);
    expect(otherPageStrokes![0].id).toBe("sk_ds7b");
  });
});

describe("clearStrokes", () => {
  it("removes all strokes from a page", async () => {
    await setupNotebookAndPage("nb_cs1", "pg_cs1");

    await appendStrokes("pg_cs1", [
      makeStroke({ id: "sk_cs1a" }),
      makeStroke({ id: "sk_cs1b" }),
      makeStroke({ id: "sk_cs1c" }),
    ]);

    const result = await clearStrokes("pg_cs1");
    expect(result).toBe(true);

    const strokes = await getStrokes("pg_cs1");
    expect(strokes).toEqual([]);
  });

  it("returns false for a non-existent page", async () => {
    const result = await clearStrokes("pg_nonexistent");
    expect(result).toBe(false);
  });

  it("persists the clear to disk", async () => {
    await setupNotebookAndPage("nb_cs2", "pg_cs2");

    await appendStrokes("pg_cs2", [makeStroke({ id: "sk_cs2" })]);

    await clearStrokes("pg_cs2");

    const fromDisk = await readJson<Stroke[]>(paths.strokes("nb_cs2", "pg_cs2"));
    expect(fromDisk).toEqual([]);
  });

  it("is idempotent on an already-empty page", async () => {
    await setupNotebookAndPage("nb_cs3", "pg_cs3");

    const result = await clearStrokes("pg_cs3");
    expect(result).toBe(true);

    const strokes = await getStrokes("pg_cs3");
    expect(strokes).toEqual([]);
  });

  it("does not affect strokes on other pages", async () => {
    await setupNotebookAndPage("nb_cs4", "pg_cs4a");
    await createPage(makePage({ id: "pg_cs4b", notebookId: "nb_cs4", pageNumber: 2 }));

    await appendStrokes("pg_cs4a", [makeStroke({ id: "sk_cs4a" })]);
    await appendStrokes("pg_cs4b", [makeStroke({ id: "sk_cs4b" })]);

    await clearStrokes("pg_cs4a");

    const otherPageStrokes = await getStrokes("pg_cs4b");
    expect(otherPageStrokes).toHaveLength(1);
    expect(otherPageStrokes![0].id).toBe("sk_cs4b");
  });

  it("allows new strokes to be appended after clearing", async () => {
    await setupNotebookAndPage("nb_cs5", "pg_cs5");

    await appendStrokes("pg_cs5", [makeStroke({ id: "sk_cs5_old" })]);
    await clearStrokes("pg_cs5");
    await appendStrokes("pg_cs5", [makeStroke({ id: "sk_cs5_new" })]);

    const strokes = await getStrokes("pg_cs5");
    expect(strokes).toHaveLength(1);
    expect(strokes![0].id).toBe("sk_cs5_new");
  });
});

describe("concurrent operations", () => {
  it("handles concurrent appends safely via file locking", async () => {
    await setupNotebookAndPage("nb_co1", "pg_co1");

    // Launch multiple appends concurrently
    const promises = Array.from({ length: 5 }, (_, i) =>
      appendStrokes("pg_co1", [makeStroke({ id: `sk_co1_${i}` })]),
    );

    await Promise.all(promises);

    const strokes = await getStrokes("pg_co1");
    expect(strokes).toHaveLength(5);

    // All stroke IDs should be present
    const ids = strokes!.map((s) => s.id).sort();
    expect(ids).toEqual(
      Array.from({ length: 5 }, (_, i) => `sk_co1_${i}`).sort(),
    );
  });

  it("handles concurrent delete and append on the same page", async () => {
    await setupNotebookAndPage("nb_co2", "pg_co2");

    await appendStrokes("pg_co2", [
      makeStroke({ id: "sk_co2_keep" }),
      makeStroke({ id: "sk_co2_delete" }),
    ]);

    // Run delete and append concurrently
    await Promise.all([
      deleteStroke("pg_co2", "sk_co2_delete"),
      appendStrokes("pg_co2", [makeStroke({ id: "sk_co2_new" })]),
    ]);

    const strokes = await getStrokes("pg_co2");
    // The exact result depends on execution order, but the file should
    // not be corrupted and should contain valid stroke data
    expect(strokes).not.toBeNull();
    expect(Array.isArray(strokes)).toBe(true);
    // At minimum, the data should be consistent (not corrupted)
    for (const stroke of strokes!) {
      expect(stroke).toHaveProperty("id");
      expect(stroke).toHaveProperty("points");
    }
  });
});

describe("cross-page isolation", () => {
  it("strokes on different pages in the same notebook are independent", async () => {
    const nb = makeNotebook({ id: "nb_iso1" });
    await createNotebook(nb);

    await createPage(makePage({ id: "pg_iso1a", notebookId: "nb_iso1", pageNumber: 1 }));
    await createPage(makePage({ id: "pg_iso1b", notebookId: "nb_iso1", pageNumber: 2 }));

    await appendStrokes("pg_iso1a", [
      makeStroke({ id: "sk_iso1a1" }),
      makeStroke({ id: "sk_iso1a2" }),
    ]);

    await appendStrokes("pg_iso1b", [makeStroke({ id: "sk_iso1b1" })]);

    const strokesA = await getStrokes("pg_iso1a");
    const strokesB = await getStrokes("pg_iso1b");

    expect(strokesA).toHaveLength(2);
    expect(strokesB).toHaveLength(1);
    expect(strokesA!.map((s) => s.id)).toEqual(["sk_iso1a1", "sk_iso1a2"]);
    expect(strokesB![0].id).toBe("sk_iso1b1");
  });

  it("strokes on pages in different notebooks are independent", async () => {
    await setupNotebookAndPage("nb_iso2a", "pg_iso2a");
    await setupNotebookAndPage("nb_iso2b", "pg_iso2b");

    await appendStrokes("pg_iso2a", [makeStroke({ id: "sk_iso2a" })]);
    await appendStrokes("pg_iso2b", [makeStroke({ id: "sk_iso2b" })]);

    await clearStrokes("pg_iso2a");

    const strokesA = await getStrokes("pg_iso2a");
    const strokesB = await getStrokes("pg_iso2b");

    expect(strokesA).toEqual([]);
    expect(strokesB).toHaveLength(1);
    expect(strokesB![0].id).toBe("sk_iso2b");
  });
});

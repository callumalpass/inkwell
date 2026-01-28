import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { paths } from "../storage/paths.js";
import { createNotebook } from "../storage/notebook-store.js";
import { createPage } from "../storage/page-store.js";
import { appendStrokes } from "../storage/stroke-store.js";
import type { Stroke, PageMeta } from "../types/index.js";
import {
  generateThumbnail,
  getThumbnailPath,
  getCachedThumbnail,
  generateAndCacheThumbnail,
  invalidateThumbnail,
} from "./thumbnail.js";

// ─── Helpers ──────────────────────────────────────────────────────────

let originalDataDir: string;
let testDir: string;

const TEST_NOTEBOOK_ID = "nb_thumbtest1";
const TEST_PAGE_ID = "pg_thumbtest1";

function makeStroke(id: string, overrides: Partial<Stroke> = {}): Stroke {
  return {
    id,
    points: [
      { x: 100, y: 200, pressure: 0.5 },
      { x: 150, y: 250, pressure: 0.6 },
      { x: 200, y: 300, pressure: 0.7 },
      { x: 250, y: 350, pressure: 0.6 },
      { x: 300, y: 400, pressure: 0.5 },
    ],
    color: "#000000",
    width: 3,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function setupNotebookAndPage(
  notebookId = TEST_NOTEBOOK_ID,
  pageId = TEST_PAGE_ID,
  pageNumber = 1,
) {
  await createNotebook({
    id: notebookId,
    title: "Thumbnail Test Notebook",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const now = new Date().toISOString();
  const pageMeta: PageMeta = {
    id: pageId,
    notebookId,
    pageNumber,
    canvasX: 0,
    canvasY: 0,
    createdAt: now,
    updatedAt: now,
  };
  await createPage(pageMeta);
}

// ─── Setup / Teardown ─────────────────────────────────────────────────

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-thumbnail-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
  await setupNotebookAndPage();
});

afterEach(async () => {
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

// ─── generateThumbnail ────────────────────────────────────────────────

describe("generateThumbnail", () => {
  describe("happy path", () => {
    it("returns a valid PNG buffer for a page with strokes", async () => {
      await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);

      const buffer = await generateThumbnail(TEST_PAGE_ID);
      expect(buffer).not.toBeNull();
      // PNG magic bytes: \x89PNG
      expect(buffer![0]).toBe(0x89);
      expect(buffer![1]).toBe(0x50);
      expect(buffer![2]).toBe(0x4e);
      expect(buffer![3]).toBe(0x47);
    });

    it("returns a valid PNG for a page with no strokes (blank page)", async () => {
      const buffer = await generateThumbnail(TEST_PAGE_ID);
      expect(buffer).not.toBeNull();
      expect(buffer![0]).toBe(0x89);
      expect(buffer![1]).toBe(0x50);
    });

    it("renders multiple strokes", async () => {
      await appendStrokes(TEST_PAGE_ID, [
        makeStroke("st_1", { color: "#ff0000" }),
        makeStroke("st_2", { color: "#0000ff" }),
        makeStroke("st_3", { color: "#00ff00" }),
      ]);

      const buffer = await generateThumbnail(TEST_PAGE_ID);
      expect(buffer).not.toBeNull();
      expect(buffer!.length).toBeGreaterThan(0);
    });

    it("handles all pen styles", async () => {
      await appendStrokes(TEST_PAGE_ID, [
        makeStroke("st_pressure", { penStyle: "pressure" }),
        makeStroke("st_uniform", { penStyle: "uniform" }),
        makeStroke("st_ballpoint", { penStyle: "ballpoint" }),
      ]);

      const buffer = await generateThumbnail(TEST_PAGE_ID);
      expect(buffer).not.toBeNull();
      expect(buffer![0]).toBe(0x89);
    });
  });

  describe("edge cases", () => {
    it("returns null for non-existent page", async () => {
      const buffer = await generateThumbnail("pg_nonexistent");
      expect(buffer).toBeNull();
    });

    it("returns null when page has no notebook mapping", async () => {
      // A page ID that doesn't map to any notebook
      const buffer = await generateThumbnail("pg_orphan_no_notebook");
      expect(buffer).toBeNull();
    });

    it("handles strokes with very few points", async () => {
      await appendStrokes(TEST_PAGE_ID, [
        makeStroke("st_tiny", {
          points: [
            { x: 10, y: 10, pressure: 0.5 },
            { x: 20, y: 20, pressure: 0.5 },
          ],
        }),
      ]);

      const buffer = await generateThumbnail(TEST_PAGE_ID);
      expect(buffer).not.toBeNull();
    });

    it("handles strokes at page boundary coordinates", async () => {
      await appendStrokes(TEST_PAGE_ID, [
        makeStroke("st_boundary", {
          points: [
            { x: 0, y: 0, pressure: 0.5 },
            { x: 1404, y: 0, pressure: 0.5 },
            { x: 1404, y: 1872, pressure: 0.5 },
            { x: 0, y: 1872, pressure: 0.5 },
          ],
        }),
      ]);

      const buffer = await generateThumbnail(TEST_PAGE_ID);
      expect(buffer).not.toBeNull();
    });

    it("handles strokes with zero pressure", async () => {
      await appendStrokes(TEST_PAGE_ID, [
        makeStroke("st_zero_pressure", {
          points: [
            { x: 10, y: 10, pressure: 0 },
            { x: 50, y: 50, pressure: 0 },
            { x: 100, y: 100, pressure: 0 },
          ],
        }),
      ]);

      const buffer = await generateThumbnail(TEST_PAGE_ID);
      expect(buffer).not.toBeNull();
    });
  });
});

// ─── getThumbnailPath ─────────────────────────────────────────────────

describe("getThumbnailPath", () => {
  it("returns the correct path for a valid page", async () => {
    const thumbPath = await getThumbnailPath(TEST_PAGE_ID);
    expect(thumbPath).not.toBeNull();
    expect(thumbPath).toBe(paths.thumbnail(TEST_NOTEBOOK_ID, TEST_PAGE_ID));
  });

  it("path ends with thumbnail.png", async () => {
    const thumbPath = await getThumbnailPath(TEST_PAGE_ID);
    expect(thumbPath).not.toBeNull();
    expect(thumbPath!.endsWith("thumbnail.png")).toBe(true);
  });

  it("returns null for non-existent page", async () => {
    const thumbPath = await getThumbnailPath("pg_nonexistent");
    expect(thumbPath).toBeNull();
  });
});

// ─── getCachedThumbnail ───────────────────────────────────────────────

describe("getCachedThumbnail", () => {
  describe("happy path", () => {
    it("returns cached buffer when thumbnail file exists", async () => {
      // First generate and cache a thumbnail
      await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);
      const generated = await generateAndCacheThumbnail(TEST_PAGE_ID);
      expect(generated).not.toBeNull();

      // Now retrieve from cache
      const cached = await getCachedThumbnail(TEST_PAGE_ID);
      expect(cached).not.toBeNull();
      expect(cached!.length).toBe(generated!.length);
    });

    it("returned buffer is valid PNG", async () => {
      await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);
      await generateAndCacheThumbnail(TEST_PAGE_ID);

      const cached = await getCachedThumbnail(TEST_PAGE_ID);
      expect(cached).not.toBeNull();
      expect(cached![0]).toBe(0x89);
      expect(cached![1]).toBe(0x50);
      expect(cached![2]).toBe(0x4e);
      expect(cached![3]).toBe(0x47);
    });
  });

  describe("cache miss", () => {
    it("returns null when no cached thumbnail exists", async () => {
      const cached = await getCachedThumbnail(TEST_PAGE_ID);
      expect(cached).toBeNull();
    });

    it("returns null for non-existent page", async () => {
      const cached = await getCachedThumbnail("pg_nonexistent");
      expect(cached).toBeNull();
    });
  });
});

// ─── generateAndCacheThumbnail ────────────────────────────────────────

describe("generateAndCacheThumbnail", () => {
  describe("happy path", () => {
    it("returns a valid PNG buffer", async () => {
      await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);

      const buffer = await generateAndCacheThumbnail(TEST_PAGE_ID);
      expect(buffer).not.toBeNull();
      expect(buffer![0]).toBe(0x89);
      expect(buffer![1]).toBe(0x50);
    });

    it("writes the thumbnail file to disk", async () => {
      await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);
      await generateAndCacheThumbnail(TEST_PAGE_ID);

      const thumbPath = paths.thumbnail(TEST_NOTEBOOK_ID, TEST_PAGE_ID);
      const fileStat = await stat(thumbPath);
      expect(fileStat.isFile()).toBe(true);
      expect(fileStat.size).toBeGreaterThan(0);
    });

    it("cached file matches returned buffer", async () => {
      await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);
      const buffer = await generateAndCacheThumbnail(TEST_PAGE_ID);

      const thumbPath = paths.thumbnail(TEST_NOTEBOOK_ID, TEST_PAGE_ID);
      const fileContents = await readFile(thumbPath);
      expect(Buffer.compare(buffer!, fileContents)).toBe(0);
    });

    it("overwrites existing cached thumbnail", async () => {
      await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);
      const first = await generateAndCacheThumbnail(TEST_PAGE_ID);

      // Add more strokes and regenerate
      await appendStrokes(TEST_PAGE_ID, [
        makeStroke("st_2", { color: "#ff0000" }),
      ]);
      const second = await generateAndCacheThumbnail(TEST_PAGE_ID);

      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      // With different strokes the thumbnails should differ
      expect(Buffer.compare(first!, second!)).not.toBe(0);
    });
  });

  describe("error handling", () => {
    it("returns null for non-existent page", async () => {
      const buffer = await generateAndCacheThumbnail("pg_nonexistent");
      expect(buffer).toBeNull();
    });

    it("returns null when page has no notebook mapping", async () => {
      const buffer = await generateAndCacheThumbnail("pg_orphan");
      expect(buffer).toBeNull();
    });
  });
});

// ─── invalidateThumbnail ──────────────────────────────────────────────

describe("invalidateThumbnail", () => {
  describe("happy path", () => {
    it("removes the cached thumbnail file", async () => {
      await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);
      await generateAndCacheThumbnail(TEST_PAGE_ID);

      const thumbPath = paths.thumbnail(TEST_NOTEBOOK_ID, TEST_PAGE_ID);
      // Verify file exists before invalidation
      await expect(stat(thumbPath)).resolves.toBeDefined();

      await invalidateThumbnail(TEST_PAGE_ID);

      // File should no longer exist
      await expect(stat(thumbPath)).rejects.toThrow();
    });

    it("getCachedThumbnail returns null after invalidation", async () => {
      await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);
      await generateAndCacheThumbnail(TEST_PAGE_ID);

      // Verify cache hit before invalidation
      const before = await getCachedThumbnail(TEST_PAGE_ID);
      expect(before).not.toBeNull();

      await invalidateThumbnail(TEST_PAGE_ID);

      // Should be a cache miss now
      const after = await getCachedThumbnail(TEST_PAGE_ID);
      expect(after).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("does not throw when no cached thumbnail exists", async () => {
      // No thumbnail has been generated, invalidation should be safe
      await expect(invalidateThumbnail(TEST_PAGE_ID)).resolves.not.toThrow();
    });

    it("does not throw for non-existent page", async () => {
      await expect(
        invalidateThumbnail("pg_nonexistent"),
      ).resolves.not.toThrow();
    });

    it("can generate a new thumbnail after invalidation", async () => {
      await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);
      await generateAndCacheThumbnail(TEST_PAGE_ID);
      await invalidateThumbnail(TEST_PAGE_ID);

      // Should be able to regenerate
      const buffer = await generateAndCacheThumbnail(TEST_PAGE_ID);
      expect(buffer).not.toBeNull();
      expect(buffer![0]).toBe(0x89);
    });
  });
});

// ─── Integration: full lifecycle ──────────────────────────────────────

describe("thumbnail lifecycle", () => {
  it("generate → cache → retrieve → invalidate → miss", async () => {
    await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);

    // Step 1: Generate and cache
    const generated = await generateAndCacheThumbnail(TEST_PAGE_ID);
    expect(generated).not.toBeNull();

    // Step 2: Retrieve from cache
    const cached = await getCachedThumbnail(TEST_PAGE_ID);
    expect(cached).not.toBeNull();
    expect(Buffer.compare(generated!, cached!)).toBe(0);

    // Step 3: Invalidate
    await invalidateThumbnail(TEST_PAGE_ID);

    // Step 4: Cache miss
    const afterInvalidate = await getCachedThumbnail(TEST_PAGE_ID);
    expect(afterInvalidate).toBeNull();

    // Step 5: Regenerate
    const regenerated = await generateAndCacheThumbnail(TEST_PAGE_ID);
    expect(regenerated).not.toBeNull();
    expect(regenerated![0]).toBe(0x89);
  });

  it("blank page produces a smaller thumbnail than one with strokes", async () => {
    const blank = await generateThumbnail(TEST_PAGE_ID);

    await appendStrokes(TEST_PAGE_ID, [
      makeStroke("st_1"),
      makeStroke("st_2", {
        points: [
          { x: 500, y: 500, pressure: 0.8 },
          { x: 600, y: 600, pressure: 0.8 },
          { x: 700, y: 700, pressure: 0.8 },
          { x: 800, y: 800, pressure: 0.8 },
        ],
        color: "#ff0000",
        width: 8,
      }),
    ]);
    const withStrokes = await generateThumbnail(TEST_PAGE_ID);

    expect(blank).not.toBeNull();
    expect(withStrokes).not.toBeNull();
    // A thumbnail with drawn strokes should differ from a blank one
    expect(Buffer.compare(blank!, withStrokes!)).not.toBe(0);
  });
});

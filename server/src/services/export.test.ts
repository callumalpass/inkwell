import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { paths } from "../storage/paths.js";
import { createNotebook } from "../storage/notebook-store.js";
import { createPage } from "../storage/page-store.js";
import { appendStrokes } from "../storage/stroke-store.js";
import { exportPagePdf, exportNotebookPdf, exportPagePng } from "./export.js";
import type { Stroke, PageMeta } from "../types/index.js";

let originalDataDir: string;
let testDir: string;

const TEST_NOTEBOOK_ID = "nb_exporttest1";
const TEST_PAGE_ID = "pg_exporttest1";

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

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-export-svc-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;

  // Set up notebook and page on disk
  await createNotebook({
    id: TEST_NOTEBOOK_ID,
    title: "Test Notebook",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const now = new Date().toISOString();
  const pageMeta: PageMeta = {
    id: TEST_PAGE_ID,
    notebookId: TEST_NOTEBOOK_ID,
    pageNumber: 1,
    canvasX: 0,
    canvasY: 0,
    createdAt: now,
    updatedAt: now,
  };
  await createPage(pageMeta);
});

afterEach(async () => {
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

describe("exportPagePdf", () => {
  it("returns a valid PDF buffer with strokes", async () => {
    await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1"), makeStroke("st_2")]);

    const buffer = await exportPagePdf(TEST_PAGE_ID);
    expect(buffer).not.toBeNull();
    expect(buffer!.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer!.length).toBeGreaterThan(200);
  });

  it("returns a valid PDF for empty page", async () => {
    const buffer = await exportPagePdf(TEST_PAGE_ID);
    expect(buffer).not.toBeNull();
    expect(buffer!.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("returns null for non-existent page", async () => {
    const buffer = await exportPagePdf("pg_nonexistent");
    expect(buffer).toBeNull();
  });

  it("includes transcription text when option set", async () => {
    await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);
    const transcriptionPath = paths.transcription(TEST_NOTEBOOK_ID, TEST_PAGE_ID);
    await writeFile(transcriptionPath, "This is the transcription", "utf-8");

    const withTranscription = await exportPagePdf(TEST_PAGE_ID, {
      includeTranscription: true,
    });
    const without = await exportPagePdf(TEST_PAGE_ID);

    expect(withTranscription).not.toBeNull();
    expect(without).not.toBeNull();
    expect(withTranscription!.length).toBeGreaterThan(without!.length);
  });

  it("produces different output for A4 vs original page size", async () => {
    await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);

    const original = await exportPagePdf(TEST_PAGE_ID, { pageSize: "original" });
    const a4 = await exportPagePdf(TEST_PAGE_ID, { pageSize: "a4" });

    expect(original).not.toBeNull();
    expect(a4).not.toBeNull();
    // Different sizes should produce different PDFs
    expect(original!.length).not.toBe(a4!.length);
  });

  it("handles strokes with different pen styles", async () => {
    await appendStrokes(TEST_PAGE_ID, [
      makeStroke("st_pressure", { penStyle: "pressure" }),
      makeStroke("st_uniform", { penStyle: "uniform" }),
      makeStroke("st_ballpoint", { penStyle: "ballpoint" }),
    ]);

    const buffer = await exportPagePdf(TEST_PAGE_ID);
    expect(buffer).not.toBeNull();
    expect(buffer!.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("exportNotebookPdf", () => {
  it("returns a valid PDF for multi-page notebook", async () => {
    // Create a second page
    const page2Id = "pg_exporttest2";
    const now = new Date().toISOString();
    await createPage({
      id: page2Id,
      notebookId: TEST_NOTEBOOK_ID,
      pageNumber: 2,
      canvasX: 500,
      canvasY: 0,
      createdAt: now,
      updatedAt: now,
    });

    await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);
    await appendStrokes(page2Id, [makeStroke("st_2")]);

    const buffer = await exportNotebookPdf(
      TEST_NOTEBOOK_ID,
      [{ id: TEST_PAGE_ID }, { id: page2Id }],
    );

    expect(buffer).not.toBeNull();
    expect(buffer!.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("returns null for empty page list", async () => {
    const buffer = await exportNotebookPdf(TEST_NOTEBOOK_ID, []);
    expect(buffer).toBeNull();
  });

  it("handles pages with no strokes in notebook", async () => {
    const buffer = await exportNotebookPdf(
      TEST_NOTEBOOK_ID,
      [{ id: TEST_PAGE_ID }],
    );
    expect(buffer).not.toBeNull();
    expect(buffer!.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("exportPagePng", () => {
  it("returns a valid PNG buffer with strokes", async () => {
    await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);

    const buffer = await exportPagePng(TEST_PAGE_ID);
    expect(buffer).not.toBeNull();
    // PNG magic bytes: \x89PNG
    expect(buffer![0]).toBe(0x89);
    expect(buffer![1]).toBe(0x50);
    expect(buffer![2]).toBe(0x4e);
    expect(buffer![3]).toBe(0x47);
  });

  it("returns a valid PNG for empty page", async () => {
    const buffer = await exportPagePng(TEST_PAGE_ID);
    expect(buffer).not.toBeNull();
    expect(buffer![0]).toBe(0x89);
  });

  it("returns null for non-existent page", async () => {
    const buffer = await exportPagePng("pg_nonexistent");
    expect(buffer).toBeNull();
  });

  it("scale=2 produces larger image", async () => {
    await appendStrokes(TEST_PAGE_ID, [makeStroke("st_1")]);

    const scale1 = await exportPagePng(TEST_PAGE_ID, 1);
    const scale2 = await exportPagePng(TEST_PAGE_ID, 2);

    expect(scale1).not.toBeNull();
    expect(scale2).not.toBeNull();
    expect(scale2!.length).toBeGreaterThan(scale1!.length);
  });

  it("handles different pen styles", async () => {
    await appendStrokes(TEST_PAGE_ID, [
      makeStroke("st_uniform", { penStyle: "uniform" }),
    ]);

    const buffer = await exportPagePng(TEST_PAGE_ID);
    expect(buffer).not.toBeNull();
    expect(buffer![0]).toBe(0x89);
  });
});

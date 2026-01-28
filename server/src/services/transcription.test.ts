import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { ensureDir, writeJson } from "../storage/fs-utils.js";
import { paths } from "../storage/paths.js";
import {
  renderPageToPng,
  saveTranscription,
  getTranscriptionContent,
} from "./transcription.js";

let originalDataDir: string;
let testDir: string;

async function setupTestPage(notebookId: string, pageId: string) {
  const dir = paths.page(notebookId, pageId);
  await ensureDir(dir);
  await writeJson(paths.pageMeta(notebookId, pageId), {
    id: pageId,
    notebookId,
    pageNumber: 1,
    canvasX: 0,
    canvasY: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await writeJson(paths.strokes(notebookId, pageId), []);
  await ensureDir(paths.data());
  await writeJson(paths.pageIndex(), { [pageId]: notebookId });
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-transcription-svc-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
});

afterEach(async () => {
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

describe("renderPageToPng", () => {
  it("returns null for empty page (no strokes)", async () => {
    await setupTestPage("nb_test", "pg_empty");

    const result = await renderPageToPng("pg_empty");
    expect(result).toBeNull();
  });

  it("returns a PNG buffer for a page with strokes", async () => {
    await setupTestPage("nb_test", "pg_drawn");
    await writeJson(paths.strokes("nb_test", "pg_drawn"), [
      {
        id: "st_1",
        points: [
          { x: 100, y: 100, pressure: 0.5 },
          { x: 200, y: 200, pressure: 0.7 },
          { x: 300, y: 300, pressure: 0.5 },
          { x: 400, y: 400, pressure: 0.5 },
        ],
        color: "#000000",
        width: 3,
        penStyle: "pressure",
        createdAt: new Date().toISOString(),
      },
    ]);

    const result = await renderPageToPng("pg_drawn");
    expect(result).not.toBeNull();
    expect(Buffer.isBuffer(result)).toBe(true);

    // PNG signature check: first 8 bytes
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(result!.subarray(0, 8).equals(pngSignature)).toBe(true);
  });

  it("renders multiple strokes with different pen styles", async () => {
    await setupTestPage("nb_test", "pg_multi");
    await writeJson(paths.strokes("nb_test", "pg_multi"), [
      {
        id: "st_pressure",
        points: [
          { x: 50, y: 50, pressure: 0.3 },
          { x: 150, y: 150, pressure: 0.8 },
          { x: 250, y: 100, pressure: 0.5 },
        ],
        color: "#000000",
        width: 3,
        penStyle: "pressure",
        createdAt: new Date().toISOString(),
      },
      {
        id: "st_uniform",
        points: [
          { x: 400, y: 50, pressure: 0.5 },
          { x: 500, y: 150, pressure: 0.5 },
          { x: 600, y: 100, pressure: 0.5 },
        ],
        color: "#0000ff",
        width: 5,
        penStyle: "uniform",
        createdAt: new Date().toISOString(),
      },
      {
        id: "st_ballpoint",
        points: [
          { x: 700, y: 50, pressure: 0.5 },
          { x: 800, y: 150, pressure: 0.5 },
          { x: 900, y: 100, pressure: 0.5 },
        ],
        color: "#ff0000",
        width: 2,
        penStyle: "ballpoint",
        createdAt: new Date().toISOString(),
      },
    ]);

    const result = await renderPageToPng("pg_multi");
    expect(result).not.toBeNull();
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("returns null for non-existent page", async () => {
    const result = await renderPageToPng("pg_nonexistent");
    expect(result).toBeNull();
  });
});

describe("saveTranscription", () => {
  it("writes transcription content to file", async () => {
    await setupTestPage("nb_test", "pg_save");

    await saveTranscription("pg_save", "Hello world");

    const content = await readFile(
      paths.transcription("nb_test", "pg_save"),
      "utf-8",
    );
    expect(content).toBe("Hello world");
  });

  it("overwrites existing transcription", async () => {
    await setupTestPage("nb_test", "pg_overwrite");

    await saveTranscription("pg_overwrite", "First version");
    await saveTranscription("pg_overwrite", "Second version");

    const content = await readFile(
      paths.transcription("nb_test", "pg_overwrite"),
      "utf-8",
    );
    expect(content).toBe("Second version");
  });

  it("throws for non-existent page", async () => {
    await expect(
      saveTranscription("pg_nonexistent", "content"),
    ).rejects.toThrow("Page pg_nonexistent not found");
  });
});

describe("getTranscriptionContent", () => {
  it("returns null when no transcription exists", async () => {
    await setupTestPage("nb_test", "pg_notranscript");

    const content = await getTranscriptionContent("pg_notranscript");
    expect(content).toBeNull();
  });

  it("returns content when transcription exists", async () => {
    await setupTestPage("nb_test", "pg_hastranscript");

    const transcriptionPath = paths.transcription("nb_test", "pg_hastranscript");
    await writeFile(transcriptionPath, "Some transcribed text", "utf-8");

    const content = await getTranscriptionContent("pg_hastranscript");
    expect(content).toBe("Some transcribed text");
  });

  it("returns null for non-existent page", async () => {
    const content = await getTranscriptionContent("pg_nonexistent");
    expect(content).toBeNull();
  });

  it("handles empty transcription file", async () => {
    await setupTestPage("nb_test", "pg_empty_transcript");

    const transcriptionPath = paths.transcription("nb_test", "pg_empty_transcript");
    await writeFile(transcriptionPath, "", "utf-8");

    const content = await getTranscriptionContent("pg_empty_transcript");
    expect(content).toBe("");
  });
});

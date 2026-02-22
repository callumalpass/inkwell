import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { paths } from "../storage/paths.js";
import { createNotebook } from "../storage/notebook-store.js";
import { createPage } from "../storage/page-store.js";
import {
  buildSearchIndex,
  updatePageIndex,
  updateNotebookIndex,
  removePageFromIndex,
  removeNotebookFromIndex,
  getIndexedPages,
  getIndexedNotebook,
  isIndexInitialized,
  getIndexStats,
  clearIndex,
} from "./search-index.js";
import type { PageMeta } from "../types/index.js";

let originalDataDir: string;
let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-search-index-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
  clearIndex();
});

afterEach(async () => {
  config.dataDir = originalDataDir;
  clearIndex();
  await rm(testDir, { recursive: true, force: true });
});

async function setupNotebookWithTranscription(
  notebookId: string,
  title: string,
  pageId: string,
  content: string,
  tags?: string[],
) {
  await createNotebook({
    id: notebookId,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const now = new Date().toISOString();
  const pageMeta: PageMeta = {
    id: pageId,
    notebookId,
    pageNumber: 1,
    canvasX: 0,
    canvasY: 0,
    createdAt: now,
    updatedAt: now,
    tags,
  };
  await createPage(pageMeta);
  await writeFile(paths.transcription(notebookId, pageId), content, "utf-8");
}

describe("buildSearchIndex", () => {
  it("indexes all pages on startup", async () => {
    await setupNotebookWithTranscription(
      "nb_idx1",
      "Work Notes",
      "pg_idx1",
      "Meeting about project alpha",
    );
    await setupNotebookWithTranscription(
      "nb_idx2",
      "Personal",
      "pg_idx2",
      "Shopping list for weekend",
    );

    await buildSearchIndex();

    expect(isIndexInitialized()).toBe(true);
    const stats = getIndexStats();
    expect(stats.pages).toBe(2);
    expect(stats.notebooks).toBe(2);
  });

  it("handles empty data directory", async () => {
    await buildSearchIndex();

    expect(isIndexInitialized()).toBe(true);
    expect(getIndexStats().pages).toBe(0);
  });

  it("indexes page tags", async () => {
    await setupNotebookWithTranscription(
      "nb_tag1",
      "Tagged Notes",
      "pg_tag1",
      "Some content",
      ["meeting", "important"],
    );

    await buildSearchIndex();

    const pages = getIndexedPages();
    expect(pages[0].tags).toEqual(["meeting", "important"]);
  });

  it("pre-lowercases content for fast search", async () => {
    await setupNotebookWithTranscription(
      "nb_lower1",
      "Notes",
      "pg_lower1",
      "Hello WORLD",
    );

    await buildSearchIndex();

    const pages = getIndexedPages();
    expect(pages[0].content).toBe("Hello WORLD");
    expect(pages[0].contentLower).toBe("hello world");
  });
});

describe("updatePageIndex", () => {
  it("updates existing page in index", async () => {
    await setupNotebookWithTranscription(
      "nb_upd1",
      "Notes",
      "pg_upd1",
      "Original content",
    );
    await buildSearchIndex();

    // Update the transcription file
    await writeFile(paths.transcription("nb_upd1", "pg_upd1"), "Updated content", "utf-8");
    await updatePageIndex("pg_upd1", "nb_upd1");

    const pages = getIndexedPages();
    expect(pages[0].content).toBe("Updated content");
  });

  it("adds new page to index", async () => {
    await setupNotebookWithTranscription(
      "nb_add1",
      "Notes",
      "pg_add1",
      "First page",
    );
    await buildSearchIndex();

    // Create a new page
    const now = new Date().toISOString();
    await createPage({
      id: "pg_add2",
      notebookId: "nb_add1",
      pageNumber: 2,
      canvasX: 100,
      canvasY: 0,
      createdAt: now,
      updatedAt: now,
    });
    await writeFile(paths.transcription("nb_add1", "pg_add2"), "Second page", "utf-8");
    await updatePageIndex("pg_add2", "nb_add1");

    expect(getIndexStats().pages).toBe(2);
  });
});

describe("updateNotebookIndex", () => {
  it("updates notebook name in all indexed pages", async () => {
    await setupNotebookWithTranscription(
      "nb_name1",
      "Original Name",
      "pg_name1",
      "Content",
    );
    await buildSearchIndex();

    // Simulate notebook rename by writing new meta
    const { ensureDir, writeJson } = await import("../storage/fs-utils.js");
    await writeJson(paths.notebookMeta("nb_name1"), {
      id: "nb_name1",
      title: "Renamed Notebook",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await updateNotebookIndex("nb_name1");

    const pages = getIndexedPages();
    expect(pages[0].notebookName).toBe("Renamed Notebook");
    expect(getIndexedNotebook("nb_name1")?.title).toBe("Renamed Notebook");
  });
});

describe("removePageFromIndex", () => {
  it("removes page from index", async () => {
    await setupNotebookWithTranscription("nb_del1", "Notes", "pg_del1", "Content");
    await buildSearchIndex();

    expect(getIndexStats().pages).toBe(1);

    removePageFromIndex("pg_del1");

    expect(getIndexStats().pages).toBe(0);
  });
});

describe("removeNotebookFromIndex", () => {
  it("removes notebook and all its pages from index", async () => {
    await setupNotebookWithTranscription("nb_delnb1", "Notes", "pg_delnb1", "Content 1");
    const now = new Date().toISOString();
    await createPage({
      id: "pg_delnb2",
      notebookId: "nb_delnb1",
      pageNumber: 2,
      canvasX: 100,
      canvasY: 0,
      createdAt: now,
      updatedAt: now,
    });
    await writeFile(paths.transcription("nb_delnb1", "pg_delnb2"), "Content 2", "utf-8");
    await buildSearchIndex();

    expect(getIndexStats().pages).toBe(2);
    expect(getIndexStats().notebooks).toBe(1);

    removeNotebookFromIndex("nb_delnb1");

    expect(getIndexStats().pages).toBe(0);
    expect(getIndexStats().notebooks).toBe(0);
  });
});

describe("getIndexedPages", () => {
  it("filters by notebook when provided", async () => {
    await setupNotebookWithTranscription("nb_filt1", "Work", "pg_filt1", "Content 1");
    await setupNotebookWithTranscription("nb_filt2", "Personal", "pg_filt2", "Content 2");
    await buildSearchIndex();

    const workPages = getIndexedPages("nb_filt1");
    expect(workPages).toHaveLength(1);
    expect(workPages[0].notebookId).toBe("nb_filt1");

    const allPages = getIndexedPages();
    expect(allPages).toHaveLength(2);
  });
});

describe("clearIndex", () => {
  it("clears all indexed data", async () => {
    await setupNotebookWithTranscription("nb_clr1", "Notes", "pg_clr1", "Content");
    await buildSearchIndex();

    expect(isIndexInitialized()).toBe(true);
    expect(getIndexStats().pages).toBe(1);

    clearIndex();

    expect(isIndexInitialized()).toBe(false);
    expect(getIndexStats().pages).toBe(0);
  });
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { paths } from "../storage/paths.js";
import { createNotebook } from "../storage/notebook-store.js";
import { createPage } from "../storage/page-store.js";
import { searchTranscriptions } from "./search.js";
import type { PageMeta } from "../types/index.js";

let originalDataDir: string;
let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-search-svc-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
});

afterEach(async () => {
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

async function setupNotebookWithTranscription(
  notebookId: string,
  title: string,
  pageId: string,
  content: string,
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
  };
  await createPage(pageMeta);
  await writeFile(paths.transcription(notebookId, pageId), content, "utf-8");
}

describe("searchTranscriptions", () => {
  it("returns matching results", async () => {
    await setupNotebookWithTranscription(
      "nb_s1", "Work", "pg_s1", "Meeting about project alpha",
    );

    const result = await searchTranscriptions("alpha");
    expect(result.total).toBe(1);
    expect(result.results[0].pageId).toBe("pg_s1");
    expect(result.results[0].notebookName).toBe("Work");
  });

  it("returns empty for no match", async () => {
    await setupNotebookWithTranscription(
      "nb_s2", "Notes", "pg_s2", "Nothing here",
    );

    const result = await searchTranscriptions("zebra");
    expect(result.total).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("case-insensitive matching", async () => {
    await setupNotebookWithTranscription(
      "nb_s3", "Notes", "pg_s3", "The QUICK Brown Fox",
    );

    const result = await searchTranscriptions("quick");
    expect(result.total).toBe(1);
  });

  it("limits results", async () => {
    for (let i = 0; i < 5; i++) {
      await setupNotebookWithTranscription(
        `nb_lim${i}`, `Notes ${i}`, `pg_lim${i}`, `common word here ${i}`,
      );
    }

    const result = await searchTranscriptions("common", { limit: 2 });
    expect(result.total).toBe(5);
    expect(result.results).toHaveLength(2);
  });

  it("filters by notebook", async () => {
    await setupNotebookWithTranscription(
      "nb_f1", "Work", "pg_f1", "Budget discussion",
    );
    await setupNotebookWithTranscription(
      "nb_f2", "Personal", "pg_f2", "Budget planning",
    );

    const result = await searchTranscriptions("budget", { notebook: "nb_f1" });
    expect(result.total).toBe(1);
    expect(result.results[0].notebookId).toBe("nb_f1");
  });

  it("returns proper excerpt for long content", async () => {
    const longContent =
      "A".repeat(200) + " important keyword " + "B".repeat(200);
    await setupNotebookWithTranscription(
      "nb_ex1", "Notes", "pg_ex1", longContent,
    );

    const result = await searchTranscriptions("keyword");
    expect(result.results[0].excerpt).toContain("keyword");
    expect(result.results[0].excerpt.length).toBeLessThan(longContent.length);
  });

  it("handles empty notebook directory gracefully", async () => {
    // No notebooks created at all
    const result = await searchTranscriptions("anything");
    expect(result.total).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("sorts results by modified date descending", async () => {
    await setupNotebookWithTranscription(
      "nb_sort1", "Older", "pg_sort1", "common word",
    );
    // Create newer one with a slightly later timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));
    await setupNotebookWithTranscription(
      "nb_sort2", "Newer", "pg_sort2", "common word",
    );

    const result = await searchTranscriptions("common");
    expect(result.total).toBe(2);
    expect(result.results[0].notebookName).toBe("Newer");
    expect(result.results[1].notebookName).toBe("Older");
  });
});

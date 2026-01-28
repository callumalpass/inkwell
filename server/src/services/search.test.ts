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

  it("limits results and indicates hasMore", async () => {
    for (let i = 0; i < 5; i++) {
      await setupNotebookWithTranscription(
        `nb_lim${i}`, `Notes ${i}`, `pg_lim${i}`, `common word here ${i}`,
      );
    }

    const result = await searchTranscriptions("common", { limit: 2 });
    expect(result.total).toBe(5);
    expect(result.results).toHaveLength(2);
    expect(result.hasMore).toBe(true);
  });

  it("supports offset for pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await setupNotebookWithTranscription(
        `nb_off${i}`, `Notes ${i}`, `pg_off${i}`, `common offset word here ${i}`,
      );
    }

    const page1 = await searchTranscriptions("offset", { limit: 2, offset: 0 });
    const page2 = await searchTranscriptions("offset", { limit: 2, offset: 2 });
    const page3 = await searchTranscriptions("offset", { limit: 2, offset: 4 });

    expect(page1.total).toBe(5);
    expect(page1.results).toHaveLength(2);
    expect(page1.hasMore).toBe(true);

    expect(page2.total).toBe(5);
    expect(page2.results).toHaveLength(2);
    expect(page2.hasMore).toBe(true);

    expect(page3.total).toBe(5);
    expect(page3.results).toHaveLength(1);
    expect(page3.hasMore).toBe(false);

    // No overlap between pages
    const allIds = [
      ...page1.results.map((r) => r.pageId),
      ...page2.results.map((r) => r.pageId),
      ...page3.results.map((r) => r.pageId),
    ];
    expect(new Set(allIds).size).toBe(5);
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
    expect(result.hasMore).toBe(false);
  });

  it("filters by matchType - transcription only", async () => {
    // Create a page with both transcription and tag containing "alpha"
    await createNotebook({
      id: "nb_mt1",
      title: "Match Type Test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = new Date().toISOString();
    await createPage({
      id: "pg_mt1",
      notebookId: "nb_mt1",
      pageNumber: 1,
      canvasX: 0,
      canvasY: 0,
      tags: ["alpha-tag"],
      createdAt: now,
      updatedAt: now,
    });
    await writeFile(paths.transcription("nb_mt1", "pg_mt1"), "Content about alpha", "utf-8");

    // Without filter, should match (transcription takes priority)
    const allResult = await searchTranscriptions("alpha");
    expect(allResult.total).toBe(1);
    expect(allResult.results[0].matchType).toBe("transcription");

    // With transcription filter, should match
    const transcriptResult = await searchTranscriptions("alpha", { matchType: ["transcription"] });
    expect(transcriptResult.total).toBe(1);

    // With tag-only filter, should not match (transcription match is excluded)
    const tagResult = await searchTranscriptions("alpha", { matchType: ["tag"] });
    expect(tagResult.total).toBe(0);
  });

  it("filters by matchType - tag only", async () => {
    await createNotebook({
      id: "nb_mt2",
      title: "Tag Match Test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = new Date().toISOString();
    await createPage({
      id: "pg_mt2",
      notebookId: "nb_mt2",
      pageNumber: 1,
      canvasX: 0,
      canvasY: 0,
      tags: ["beta-unique-tag"],
      createdAt: now,
      updatedAt: now,
    });
    // No transcription, so tag match will be the only match type

    const result = await searchTranscriptions("beta", { matchType: ["tag"] });
    expect(result.total).toBe(1);
    expect(result.results[0].matchType).toBe("tag");

    // With transcription filter, should not match
    const transcriptResult = await searchTranscriptions("beta", { matchType: ["transcription"] });
    expect(transcriptResult.total).toBe(0);
  });

  it("filters by multiple matchTypes", async () => {
    await createNotebook({
      id: "nb_mt3",
      title: "Gamma Notebook",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = new Date().toISOString();
    await createPage({
      id: "pg_mt3a",
      notebookId: "nb_mt3",
      pageNumber: 1,
      canvasX: 0,
      canvasY: 0,
      createdAt: now,
      updatedAt: now,
    });
    await writeFile(paths.transcription("nb_mt3", "pg_mt3a"), "Content about gamma", "utf-8");

    await createPage({
      id: "pg_mt3b",
      notebookId: "nb_mt3",
      pageNumber: 2,
      canvasX: 100,
      canvasY: 0,
      tags: ["gamma-tag"],
      createdAt: now,
      updatedAt: now,
    });
    // No transcription for pg_mt3b, so it will be a tag match

    // Filter by transcription OR tag should get both
    const result = await searchTranscriptions("gamma", { matchType: ["transcription", "tag"] });
    expect(result.total).toBe(2);
  });

  it("sorts results by relevance score", async () => {
    // Create pages with different relevance characteristics
    await setupNotebookWithTranscription(
      "nb_rel1", "Notebook A", "pg_rel1", "This has the word apple mentioned once at the end.",
    );
    await setupNotebookWithTranscription(
      "nb_rel2", "Notebook B", "pg_rel2", "apple apple apple - mentioned multiple times",
    );
    await setupNotebookWithTranscription(
      "nb_rel3", "Notebook C", "pg_rel3", "The apple appears early and is an exact word match",
    );

    const result = await searchTranscriptions("apple");
    expect(result.total).toBe(3);
    // Results should include score and be sorted by it
    expect(result.results[0]).toHaveProperty("score");
    expect(typeof result.results[0].score).toBe("number");
    // Higher scores should come first
    expect(result.results[0].score).toBeGreaterThanOrEqual(result.results[1].score);
    expect(result.results[1].score).toBeGreaterThanOrEqual(result.results[2].score);
  });

  it("gives higher score to exact word matches", async () => {
    await setupNotebookWithTranscription(
      "nb_exact1", "Notebook A", "pg_exact1", "I love test code quality",
    );
    await setupNotebookWithTranscription(
      "nb_exact2", "Notebook B", "pg_exact2", "I was testing something",
    );

    const result = await searchTranscriptions("test");
    expect(result.total).toBe(2);
    // "test" as exact word vs "testing" which only contains "test"
    const exactMatch = result.results.find((r) => r.notebookName === "Notebook A");
    const partialMatch = result.results.find((r) => r.notebookName === "Notebook B");
    expect(exactMatch).toBeDefined();
    expect(partialMatch).toBeDefined();
    // The exact word match should score higher
    expect(exactMatch!.score).toBeGreaterThan(partialMatch!.score);
  });

  it("gives higher score to multiple occurrences", async () => {
    await setupNotebookWithTranscription(
      "nb_multi1", "Single", "pg_multi1", "This mentions budget once",
    );
    await setupNotebookWithTranscription(
      "nb_multi2", "Multiple", "pg_multi2", "budget budget budget - budget planning for budget",
    );

    const result = await searchTranscriptions("budget");
    expect(result.total).toBe(2);
    const singleMatch = result.results.find((r) => r.notebookName === "Single");
    const multiMatch = result.results.find((r) => r.notebookName === "Multiple");
    expect(multiMatch!.score).toBeGreaterThan(singleMatch!.score);
  });
});

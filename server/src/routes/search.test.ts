import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { buildApp } from "../app.js";
import { paths } from "../storage/paths.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let originalDataDir: string;
let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-search-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

async function createNotebookWithTranscription(
  title: string,
  transcriptionContent: string,
) {
  const nb = await app.inject({
    method: "POST",
    url: "/api/notebooks",
    payload: { title },
  });
  const notebookId = nb.json().id;

  const pg = await app.inject({
    method: "POST",
    url: `/api/notebooks/${notebookId}/pages`,
  });
  const pageId = pg.json().id;

  const transcriptionPath = paths.transcription(notebookId, pageId);
  await writeFile(transcriptionPath, transcriptionContent, "utf-8");

  return { notebookId, pageId };
}

describe("GET /api/search", () => {
  it("finds pages matching the query", async () => {
    await createNotebookWithTranscription(
      "Meeting Notes",
      "Discussed the launch date for Project Alpha",
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=launch",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].notebookName).toBe("Meeting Notes");
    expect(body.results[0].excerpt).toContain("launch");
    expect(body.results[0].thumbnailUrl).toMatch(/\/api\/pages\/pg_/);
  });

  it("returns empty results for no matches", async () => {
    await createNotebookWithTranscription(
      "Notes",
      "Nothing relevant here",
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=quantum",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(0);
    expect(res.json().results).toHaveLength(0);
  });

  it("performs case-insensitive search", async () => {
    await createNotebookWithTranscription(
      "Notes",
      "The Quick Brown Fox Jumps",
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=quick",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
  });

  it("searches across multiple notebooks", async () => {
    await createNotebookWithTranscription("Work", "Budget meeting discussion");
    await createNotebookWithTranscription("Personal", "Budget planning for vacation");
    await createNotebookWithTranscription("Other", "No match here");

    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=budget",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(2);
    expect(res.json().results).toHaveLength(2);
  });

  it("filters by notebook when specified", async () => {
    const { notebookId } = await createNotebookWithTranscription(
      "Work",
      "Budget meeting discussion",
    );
    await createNotebookWithTranscription(
      "Personal",
      "Budget planning for vacation",
    );

    const res = await app.inject({
      method: "GET",
      url: `/api/search?q=budget&notebook=${notebookId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    expect(res.json().results[0].notebookId).toBe(notebookId);
  });

  it("respects limit parameter", async () => {
    // Create 5 pages with matching content
    for (let i = 0; i < 5; i++) {
      await createNotebookWithTranscription(`Notes ${i}`, `Topic alpha discussion ${i}`);
    }

    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=alpha&limit=2",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(5);
    expect(res.json().results).toHaveLength(2);
  });

  it("returns 400 when query is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/search",
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns proper excerpt with context", async () => {
    const longText =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
      "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
      "The important keyword appears here in the middle of the text. " +
      "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.";

    await createNotebookWithTranscription("Long Text", longText);

    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=keyword",
    });

    expect(res.statusCode).toBe(200);
    const excerpt = res.json().results[0].excerpt;
    expect(excerpt).toContain("keyword");
    expect(excerpt.length).toBeLessThan(longText.length);
  });

  it("includes all required fields in results", async () => {
    const { notebookId, pageId } = await createNotebookWithTranscription(
      "Full Fields",
      "Testing all fields present",
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=fields",
    });

    const result = res.json().results[0];
    expect(result).toHaveProperty("pageId");
    expect(result).toHaveProperty("notebookId");
    expect(result).toHaveProperty("notebookName");
    expect(result).toHaveProperty("excerpt");
    expect(result).toHaveProperty("modified");
    expect(result).toHaveProperty("thumbnailUrl");
    expect(result.pageId).toBe(pageId);
    expect(result.notebookId).toBe(notebookId);
    expect(result.notebookName).toBe("Full Fields");
  });

  it("returns empty results when no transcriptions exist", async () => {
    // Create a notebook with a page but no transcription
    const nb = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "Empty" },
    });
    await app.inject({
      method: "POST",
      url: `/api/notebooks/${nb.json().id}/pages`,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=anything",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(0);
  });

  it("clamps limit to 100", async () => {
    await createNotebookWithTranscription("Notes", "test content");

    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=test&limit=500",
    });

    // Should still work, just clamped
    expect(res.statusCode).toBe(200);
  });
});

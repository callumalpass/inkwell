import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { buildApp } from "../app.js";
import { stopQueue } from "../services/transcription-queue.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let originalDataDir: string;
let originalApiKey: string;
let testDir: string;

async function createNotebookAndPage(app: FastifyInstance) {
  const nbRes = await app.inject({
    method: "POST",
    url: "/api/notebooks",
    payload: { title: "Test NB" },
  });
  const notebook = nbRes.json();

  const pgRes = await app.inject({
    method: "POST",
    url: `/api/notebooks/${notebook.id}/pages`,
  });
  const page = pgRes.json();
  return { notebook, page };
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-transcription-test-"));
  originalDataDir = config.dataDir;
  originalApiKey = config.gemini.apiKey;
  config.dataDir = testDir;
  config.gemini.apiKey = ""; // No real API key in tests
  app = await buildApp();
});

afterEach(async () => {
  stopQueue();
  await app.close();
  config.dataDir = originalDataDir;
  config.gemini.apiKey = originalApiKey;
  await rm(testDir, { recursive: true, force: true });
});

describe("POST /api/pages/:pageId/transcribe", () => {
  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/pages/pg_missing/transcribe",
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  it("queues a transcription job and returns pending status", async () => {
    const { page } = await createNotebookAndPage(app);

    const res = await app.inject({
      method: "POST",
      url: `/api/pages/${page.id}/transcribe`,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("pending");
    expect(body.pageId).toBe(page.id);
  });

  it("does not re-queue if already pending", async () => {
    const { notebook, page } = await createNotebookAndPage(app);

    // Directly write the page meta with pending status to simulate queue state
    const { readJson, writeJson } = await import("../storage/fs-utils.js");
    const { paths } = await import("../storage/paths.js");
    const meta = await readJson<{ transcription?: { status: string; lastAttempt: string | null; error: string | null } }>(paths.pageMeta(notebook.id, page.id));
    if (!meta) throw new Error("Page meta not found");
    meta.transcription = { status: "pending", lastAttempt: null, error: null };
    await writeJson(paths.pageMeta(notebook.id, page.id), meta);

    // Now trigger — should report already in queue
    const res = await app.inject({
      method: "POST",
      url: `/api/pages/${page.id}/transcribe`,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("pending");
    expect(body.message).toBe("Already in queue");
  });

  it("allows force re-transcription", async () => {
    const { page } = await createNotebookAndPage(app);

    const res = await app.inject({
      method: "POST",
      url: `/api/pages/${page.id}/transcribe`,
      payload: { force: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("pending");
  });
});

describe("GET /api/pages/:pageId/transcription", () => {
  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/pages/pg_missing/transcription",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns none status for new page with no transcription", async () => {
    const { page } = await createNotebookAndPage(app);

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${page.id}/transcription`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("none");
    expect(body.content).toBe("");
    expect(body.lastAttempt).toBeNull();
    expect(body.error).toBeNull();
  });

  it("returns content when transcription.md exists", async () => {
    const { notebook, page } = await createNotebookAndPage(app);

    // Write a transcription file directly
    const transcriptionPath = join(
      testDir,
      "notebooks",
      notebook.id,
      "pages",
      page.id,
      "transcription.md",
    );
    const { writeFile } = await import("node:fs/promises");
    await writeFile(transcriptionPath, "Hello world transcription", "utf-8");

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${page.id}/transcription`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.content).toBe("Hello world transcription");
  });
});

describe("POST /api/notebooks/:notebookId/transcribe", () => {
  it("returns 404 for non-existent notebook", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/notebooks/nb_missing/transcribe",
    });
    expect(res.statusCode).toBe(404);
  });

  it("queues all non-complete pages", async () => {
    const nbRes = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "Bulk Test" },
    });
    const notebook = nbRes.json();

    // Create 3 pages
    await app.inject({ method: "POST", url: `/api/notebooks/${notebook.id}/pages` });
    await app.inject({ method: "POST", url: `/api/notebooks/${notebook.id}/pages` });
    await app.inject({ method: "POST", url: `/api/notebooks/${notebook.id}/pages` });

    const res = await app.inject({
      method: "POST",
      url: `/api/notebooks/${notebook.id}/transcribe`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.queued).toBe(3);
  });

  it("skips pages already marked complete", async () => {
    const nbRes = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "Partial Bulk" },
    });
    const notebook = nbRes.json();

    const pg1Res = await app.inject({
      method: "POST",
      url: `/api/notebooks/${notebook.id}/pages`,
    });
    const page1 = pg1Res.json();
    await app.inject({ method: "POST", url: `/api/notebooks/${notebook.id}/pages` });

    // Mark page1 as complete by updating its meta
    const { readJson, writeJson } = await import("../storage/fs-utils.js");
    const { paths } = await import("../storage/paths.js");
    const meta = await readJson<{ transcription?: { status: string; lastAttempt: string | null; error: string | null } }>(paths.pageMeta(notebook.id, page1.id));
    if (meta) {
      meta.transcription = { status: "complete", lastAttempt: new Date().toISOString(), error: null };
      await writeJson(paths.pageMeta(notebook.id, page1.id), meta);
    }

    const res = await app.inject({
      method: "POST",
      url: `/api/notebooks/${notebook.id}/transcribe`,
    });
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.queued).toBe(1); // Only page2
  });
});

describe("GET /api/transcription/queue", () => {
  it("returns empty queue initially", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/transcription/queue",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.pending).toBe(0);
    expect(body.jobs).toEqual([]);
  });

  it("shows jobs after queuing transcriptions", async () => {
    const { page } = await createNotebookAndPage(app);

    await app.inject({
      method: "POST",
      url: `/api/pages/${page.id}/transcribe`,
      payload: {},
    });

    // Give the queue a moment to settle
    await new Promise((r) => setTimeout(r, 50));

    const res = await app.inject({
      method: "GET",
      url: "/api/transcription/queue",
    });
    expect(res.statusCode).toBe(200);
    // Queue may have already processed (and failed since no API key)
    // Just verify the structure is correct
    const body = res.json();
    expect(typeof body.pending).toBe("number");
    expect(Array.isArray(body.jobs)).toBe(true);
  });
});

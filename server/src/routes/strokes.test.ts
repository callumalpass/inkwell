import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let originalDataDir: string;
let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-strokes-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

async function createNotebookAndPage() {
  const nb = await app.inject({
    method: "POST",
    url: "/api/notebooks",
    payload: { title: "Stroke Test" },
  });
  const notebookId = nb.json().id;

  const pg = await app.inject({
    method: "POST",
    url: `/api/notebooks/${notebookId}/pages`,
  });
  return { notebookId, pageId: pg.json().id as string };
}

function makeStroke(id: string) {
  return {
    id,
    points: [
      { x: 10, y: 20, pressure: 0.5 },
      { x: 30, y: 40, pressure: 0.5 },
    ],
    color: "#000000",
    width: 3,
    createdAt: new Date().toISOString(),
  };
}

describe("GET /api/pages/:pageId/strokes", () => {
  it("returns empty array for a new page", async () => {
    const { pageId } = await createNotebookAndPage();
    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/strokes`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/pages/pg_missing/strokes",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/pages/:pageId/strokes", () => {
  it("appends strokes and returns count", async () => {
    const { pageId } = await createNotebookAndPage();
    const res = await app.inject({
      method: "POST",
      url: `/api/pages/${pageId}/strokes`,
      payload: { strokes: [makeStroke("st_1")] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(1);
  });

  it("persists strokes across requests", async () => {
    const { pageId } = await createNotebookAndPage();

    await app.inject({
      method: "POST",
      url: `/api/pages/${pageId}/strokes`,
      payload: { strokes: [makeStroke("st_1")] },
    });
    await app.inject({
      method: "POST",
      url: `/api/pages/${pageId}/strokes`,
      payload: { strokes: [makeStroke("st_2")] },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/strokes`,
    });
    expect(res.json()).toHaveLength(2);
    expect(res.json().map((s: { id: string }) => s.id)).toEqual(["st_1", "st_2"]);
  });

  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/pages/pg_missing/strokes",
      payload: { strokes: [makeStroke("st_1")] },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/pages/:pageId/strokes/:strokeId", () => {
  it("removes one stroke", async () => {
    const { pageId } = await createNotebookAndPage();

    await app.inject({
      method: "POST",
      url: `/api/pages/${pageId}/strokes`,
      payload: { strokes: [makeStroke("st_1"), makeStroke("st_2")] },
    });

    const del = await app.inject({
      method: "DELETE",
      url: `/api/pages/${pageId}/strokes/st_1`,
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().count).toBe(1);

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/strokes`,
    });
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].id).toBe("st_2");
  });

  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/pages/pg_missing/strokes/st_1",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/pages/:pageId/strokes (clear all)", () => {
  it("clears all strokes and returns 204", async () => {
    const { pageId } = await createNotebookAndPage();

    await app.inject({
      method: "POST",
      url: `/api/pages/${pageId}/strokes`,
      payload: { strokes: [makeStroke("st_1"), makeStroke("st_2")] },
    });

    const del = await app.inject({
      method: "DELETE",
      url: `/api/pages/${pageId}/strokes`,
    });
    expect(del.statusCode).toBe(204);

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/strokes`,
    });
    expect(res.json()).toEqual([]);
  });

  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/pages/pg_missing/strokes",
    });
    expect(res.statusCode).toBe(404);
  });
});

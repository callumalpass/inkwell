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
  testDir = await mkdtemp(join(tmpdir(), "inkwell-pages-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

async function createNotebook(title = "Test Notebook") {
  const res = await app.inject({
    method: "POST",
    url: "/api/notebooks",
    payload: { title },
  });
  return res.json() as { id: string };
}

async function createPage(notebookId: string) {
  const res = await app.inject({
    method: "POST",
    url: `/api/notebooks/${notebookId}/pages`,
  });
  return { res, body: res.json() };
}

describe("GET /api/notebooks/:notebookId/pages", () => {
  it("returns empty array for a new notebook", async () => {
    const nb = await createNotebook();
    const res = await app.inject({
      method: "GET",
      url: `/api/notebooks/${nb.id}/pages`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns 404 for non-existent notebook", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/notebooks/nb_missing/pages",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/notebooks/:notebookId/pages", () => {
  it("creates a page with auto-positioned canvas coordinates", async () => {
    const nb = await createNotebook();
    const { res, body } = await createPage(nb.id);

    expect(res.statusCode).toBe(201);
    expect(body.id).toMatch(/^pg_/);
    expect(body.notebookId).toBe(nb.id);
    expect(body.pageNumber).toBe(1);
    expect(body.canvasX).toBe(0);
    expect(body.canvasY).toBe(0);
  });

  it("positions second page in next column", async () => {
    const nb = await createNotebook();
    await createPage(nb.id);
    const { body } = await createPage(nb.id);

    expect(body.pageNumber).toBe(2);
    // Second page: col=1, row=0 → x = 1 * (400 + 60) = 460
    expect(body.canvasX).toBe(460);
    expect(body.canvasY).toBe(0);
  });

  it("wraps to next row after 3 columns", async () => {
    const nb = await createNotebook();
    await createPage(nb.id);
    await createPage(nb.id);
    await createPage(nb.id);
    const { body } = await createPage(nb.id);

    expect(body.pageNumber).toBe(4);
    // Fourth page: col=0, row=1
    expect(body.canvasX).toBe(0);
    // canvasY = 1 * (round(400 * 1872/1404) + 60) = 1 * (533 + 60) = 593
    // Actually: round(400 * 1872 / 1404) = round(533.333) = 533
    expect(body.canvasY).toBe(533 + 60);
  });

  it("returns 404 for non-existent notebook", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/notebooks/nb_missing/pages",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/pages/:pageId", () => {
  it("returns page metadata", async () => {
    const nb = await createNotebook();
    const { body: page } = await createPage(nb.id);

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${page.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(page.id);
    expect(res.json().notebookId).toBe(nb.id);
  });

  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/pages/pg_missing",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /api/pages/:pageId", () => {
  it("updates canvasX and canvasY", async () => {
    const nb = await createNotebook();
    const { body: page } = await createPage(nb.id);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/pages/${page.id}`,
      payload: { canvasX: 100, canvasY: 200 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().canvasX).toBe(100);
    expect(res.json().canvasY).toBe(200);
  });

  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/pages/pg_missing",
      payload: { canvasX: 10 },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/pages/:pageId", () => {
  it("deletes a page and returns 204", async () => {
    const nb = await createNotebook();
    const { body: page } = await createPage(nb.id);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/pages/${page.id}`,
    });
    expect(res.statusCode).toBe(204);

    const check = await app.inject({
      method: "GET",
      url: `/api/pages/${page.id}`,
    });
    expect(check.statusCode).toBe(404);
  });

  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/pages/pg_missing",
    });
    expect(res.statusCode).toBe(404);
  });
});

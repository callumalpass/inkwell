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

describe("PATCH /api/pages/:pageId (links)", () => {
  it("sets links on a page", async () => {
    const nb = await createNotebook();
    const { body: page1 } = await createPage(nb.id);
    const { body: page2 } = await createPage(nb.id);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/pages/${page1.id}`,
      payload: { links: [page2.id] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().links).toEqual([page2.id]);
  });

  it("replaces links entirely", async () => {
    const nb = await createNotebook();
    const { body: page1 } = await createPage(nb.id);
    const { body: page2 } = await createPage(nb.id);
    const { body: page3 } = await createPage(nb.id);

    await app.inject({
      method: "PATCH",
      url: `/api/pages/${page1.id}`,
      payload: { links: [page2.id] },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/pages/${page1.id}`,
      payload: { links: [page3.id] },
    });
    expect(res.json().links).toEqual([page3.id]);
  });

  it("clears links with empty array", async () => {
    const nb = await createNotebook();
    const { body: page1 } = await createPage(nb.id);
    const { body: page2 } = await createPage(nb.id);

    await app.inject({
      method: "PATCH",
      url: `/api/pages/${page1.id}`,
      payload: { links: [page2.id] },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/pages/${page1.id}`,
      payload: { links: [] },
    });
    expect(res.json().links).toEqual([]);
  });

  it("rejects invalid link IDs", async () => {
    const nb = await createNotebook();
    const { body: page } = await createPage(nb.id);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/pages/${page.id}`,
      payload: { links: ["../etc/passwd"] },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/pages/:pageId (tags)", () => {
  it("sets tags on a page", async () => {
    const nb = await createNotebook();
    const { body: page } = await createPage(nb.id);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/pages/${page.id}`,
      payload: { tags: ["meeting", "project-x"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tags).toEqual(["meeting", "project-x"]);
  });

  it("replaces tags entirely", async () => {
    const nb = await createNotebook();
    const { body: page } = await createPage(nb.id);

    await app.inject({
      method: "PATCH",
      url: `/api/pages/${page.id}`,
      payload: { tags: ["old-tag"] },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/pages/${page.id}`,
      payload: { tags: ["new-tag"] },
    });
    expect(res.json().tags).toEqual(["new-tag"]);
  });

  it("clears tags with empty array", async () => {
    const nb = await createNotebook();
    const { body: page } = await createPage(nb.id);

    await app.inject({
      method: "PATCH",
      url: `/api/pages/${page.id}`,
      payload: { tags: ["something"] },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/pages/${page.id}`,
      payload: { tags: [] },
    });
    expect(res.json().tags).toEqual([]);
  });

  it("rejects empty string tags", async () => {
    const nb = await createNotebook();
    const { body: page } = await createPage(nb.id);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/pages/${page.id}`,
      payload: { tags: [""] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("persists tags across reads", async () => {
    const nb = await createNotebook();
    const { body: page } = await createPage(nb.id);

    await app.inject({
      method: "PATCH",
      url: `/api/pages/${page.id}`,
      payload: { tags: ["important", "todo"] },
    });

    const read = await app.inject({
      method: "GET",
      url: `/api/pages/${page.id}`,
    });
    expect(read.json().tags).toEqual(["important", "todo"]);
  });

  it("can set links and tags together", async () => {
    const nb = await createNotebook();
    const { body: page1 } = await createPage(nb.id);
    const { body: page2 } = await createPage(nb.id);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/pages/${page1.id}`,
      payload: {
        links: [page2.id],
        tags: ["related"],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().links).toEqual([page2.id]);
    expect(res.json().tags).toEqual(["related"]);
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

describe("POST /api/pages/move", () => {
  it("moves a single page to another notebook", async () => {
    const srcNb = await createNotebook("Source");
    const dstNb = await createNotebook("Destination");
    const { body: page } = await createPage(srcNb.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: [page.id], targetNotebookId: dstNb.id },
    });

    expect(res.statusCode).toBe(200);
    const { moved } = res.json();
    expect(moved).toHaveLength(1);
    expect(moved[0].id).toBe(page.id);
    expect(moved[0].notebookId).toBe(dstNb.id);
  });

  it("moves multiple pages to another notebook", async () => {
    const srcNb = await createNotebook("Source");
    const dstNb = await createNotebook("Destination");
    const { body: page1 } = await createPage(srcNb.id);
    const { body: page2 } = await createPage(srcNb.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: [page1.id, page2.id], targetNotebookId: dstNb.id },
    });

    expect(res.statusCode).toBe(200);
    const { moved } = res.json();
    expect(moved).toHaveLength(2);
  });

  it("assigns sequential page numbers in target notebook", async () => {
    const srcNb = await createNotebook("Source");
    const dstNb = await createNotebook("Destination");
    // Create existing page in destination
    await createPage(dstNb.id);
    const { body: page } = await createPage(srcNb.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: [page.id], targetNotebookId: dstNb.id },
    });

    expect(res.statusCode).toBe(200);
    const { moved } = res.json();
    expect(moved[0].pageNumber).toBe(2);
  });

  it("returns 404 for non-existent target notebook", async () => {
    const srcNb = await createNotebook("Source");
    const { body: page } = await createPage(srcNb.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: [page.id], targetNotebookId: "nb_missing" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Target notebook not found");
  });

  it("returns 400 for non-existent page", async () => {
    const dstNb = await createNotebook("Destination");

    const res = await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: ["pg_missing"], targetNotebookId: dstNb.id },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("Page not found");
  });

  it("returns 400 when moving page to its current notebook", async () => {
    const nb = await createNotebook("Notebook");
    const { body: page } = await createPage(nb.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: [page.id], targetNotebookId: nb.id },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("already in target notebook");
  });

  it("validates pageIds are in correct format", async () => {
    const nb = await createNotebook("Notebook");

    const res = await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: ["../invalid"], targetNotebookId: nb.id },
    });

    expect(res.statusCode).toBe(400);
  });

  it("validates targetNotebookId is in correct format", async () => {
    const srcNb = await createNotebook("Source");
    const { body: page } = await createPage(srcNb.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: [page.id], targetNotebookId: "../invalid" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("requires at least one pageId", async () => {
    const dstNb = await createNotebook("Destination");

    const res = await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: [], targetNotebookId: dstNb.id },
    });

    expect(res.statusCode).toBe(400);
  });

  it("removes pages from source notebook list", async () => {
    const srcNb = await createNotebook("Source");
    const dstNb = await createNotebook("Destination");
    const { body: page } = await createPage(srcNb.id);

    await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: [page.id], targetNotebookId: dstNb.id },
    });

    const srcPages = await app.inject({
      method: "GET",
      url: `/api/notebooks/${srcNb.id}/pages`,
    });
    expect(srcPages.json()).toHaveLength(0);
  });

  it("adds pages to destination notebook list", async () => {
    const srcNb = await createNotebook("Source");
    const dstNb = await createNotebook("Destination");
    const { body: page } = await createPage(srcNb.id);

    await app.inject({
      method: "POST",
      url: "/api/pages/move",
      payload: { pageIds: [page.id], targetNotebookId: dstNb.id },
    });

    const dstPages = await app.inject({
      method: "GET",
      url: `/api/notebooks/${dstNb.id}/pages`,
    });
    expect(dstPages.json()).toHaveLength(1);
    expect(dstPages.json()[0].id).toBe(page.id);
  });
});

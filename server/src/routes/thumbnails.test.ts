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
  testDir = await mkdtemp(join(tmpdir(), "inkwell-thumbnails-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

function makeStroke(id: string, overrides: Record<string, unknown> = {}) {
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

async function createNotebookWithPage() {
  const nb = await app.inject({
    method: "POST",
    url: "/api/notebooks",
    payload: { title: "Thumbnail Test" },
  });
  const notebookId = nb.json().id;

  const pg = await app.inject({
    method: "POST",
    url: `/api/notebooks/${notebookId}/pages`,
  });
  return { notebookId, pageId: pg.json().id as string };
}

async function addStrokes(pageId: string, count: number = 1) {
  const strokes = Array.from({ length: count }, (_, i) =>
    makeStroke(`st_${i + 1}`),
  );
  await app.inject({
    method: "POST",
    url: `/api/pages/${pageId}/strokes`,
    payload: { strokes },
  });
}

// ─── GET /api/pages/:pageId/thumbnail ──────────────────────────────────

describe("GET /api/pages/:pageId/thumbnail", () => {
  describe("happy path", () => {
    it("returns a valid PNG thumbnail for a page with strokes", async () => {
      const { pageId } = await createNotebookWithPage();
      await addStrokes(pageId, 3);

      const res = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("image/png");

      // Verify PNG magic bytes
      const body = res.rawPayload;
      expect(body[0]).toBe(0x89);
      expect(body[1]).toBe(0x50); // P
      expect(body[2]).toBe(0x4e); // N
      expect(body[3]).toBe(0x47); // G
    });

    it("returns a valid PNG thumbnail for a page with no strokes", async () => {
      const { pageId } = await createNotebookWithPage();

      const res = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("image/png");

      // Should still be a valid PNG (blank page)
      const body = res.rawPayload;
      expect(body[0]).toBe(0x89);
      expect(body[1]).toBe(0x50);
    });

    it("sets Cache-Control header for client caching", async () => {
      const { pageId } = await createNotebookWithPage();

      const res = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toBe("public, max-age=60");
    });
  });

  describe("caching behavior", () => {
    it("serves from cache on second request", async () => {
      const { notebookId, pageId } = await createNotebookWithPage();
      await addStrokes(pageId, 2);

      // First request: generates and caches the thumbnail
      const first = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });
      expect(first.statusCode).toBe(200);

      // Verify the cache file was written
      const thumbPath = paths.thumbnail(notebookId, pageId);
      const { stat } = await import("node:fs/promises");
      await expect(stat(thumbPath)).resolves.toBeDefined();

      // Second request: should serve from cache
      const second = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });
      expect(second.statusCode).toBe(200);
      expect(second.headers["content-type"]).toBe("image/png");

      // Both responses should have the same content
      expect(Buffer.compare(first.rawPayload, second.rawPayload)).toBe(0);
    });

    it("serves pre-existing cached thumbnail", async () => {
      const { notebookId, pageId } = await createNotebookWithPage();

      // Manually write a cached thumbnail (a tiny valid PNG)
      const thumbPath = paths.thumbnail(notebookId, pageId);
      // Minimal valid PNG: 1x1 transparent pixel
      const minimalPng = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        0x00,
        0x00,
        0x00,
        0x0d,
        0x49,
        0x48,
        0x44,
        0x52,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x01,
        0x08,
        0x06,
        0x00,
        0x00,
        0x00,
        0x1f,
        0x15,
        0xc4,
        0x89,
        0x00,
        0x00,
        0x00,
        0x0a,
        0x49,
        0x44,
        0x41,
        0x54,
        0x78,
        0x9c,
        0x63,
        0x00,
        0x01,
        0x00,
        0x00,
        0x05,
        0x00,
        0x01,
        0x0d,
        0x0a,
        0x2d,
        0xb4,
        0x00,
        0x00,
        0x00,
        0x00,
        0x49,
        0x45,
        0x4e,
        0x44,
        0xae,
        0x42,
        0x60,
        0x82,
      ]);
      await writeFile(thumbPath, minimalPng);

      const res = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("image/png");
      // Should return our pre-cached minimal PNG
      expect(Buffer.compare(res.rawPayload, minimalPng)).toBe(0);
    });
  });

  describe("error handling", () => {
    it("returns 404 for non-existent page", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/pages/pg_nonexistent/thumbnail",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Page not found" });
    });

    it("returns 404 for invalid page ID format", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/pages/invalid-id/thumbnail",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Page not found" });
    });

    it("returns 404 for deleted page", async () => {
      const { pageId } = await createNotebookWithPage();
      await addStrokes(pageId);

      // First, verify the page exists and thumbnail works
      const firstRes = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });
      expect(firstRes.statusCode).toBe(200);

      // Delete the page
      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/api/pages/${pageId}`,
      });
      expect(deleteRes.statusCode).toBe(204);

      // Now the thumbnail should return 404
      const res = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("stroke variations", () => {
    it("generates thumbnail with different pen styles", async () => {
      const { pageId } = await createNotebookWithPage();

      await app.inject({
        method: "POST",
        url: `/api/pages/${pageId}/strokes`,
        payload: {
          strokes: [
            makeStroke("st_pressure", { penStyle: "pressure" }),
            makeStroke("st_uniform", { penStyle: "uniform" }),
            makeStroke("st_ballpoint", { penStyle: "ballpoint" }),
          ],
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.rawPayload[0]).toBe(0x89);
      expect(res.rawPayload.length).toBeGreaterThan(100);
    });

    it("generates thumbnail with various stroke colors", async () => {
      const { pageId } = await createNotebookWithPage();

      await app.inject({
        method: "POST",
        url: `/api/pages/${pageId}/strokes`,
        payload: {
          strokes: [
            makeStroke("st_black", { color: "#000000" }),
            makeStroke("st_blue", { color: "#0000ff" }),
            makeStroke("st_red", { color: "#ff0000" }),
            makeStroke("st_green", { color: "#00ff00" }),
          ],
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.rawPayload[0]).toBe(0x89);
    });

    it("generates thumbnail with varying stroke widths", async () => {
      const { pageId } = await createNotebookWithPage();

      await app.inject({
        method: "POST",
        url: `/api/pages/${pageId}/strokes`,
        payload: {
          strokes: [
            makeStroke("st_thin", { width: 1 }),
            makeStroke("st_medium", { width: 5 }),
            makeStroke("st_thick", { width: 15 }),
          ],
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.rawPayload[0]).toBe(0x89);
    });
  });

  describe("thumbnail content varies with strokes", () => {
    it("blank page produces different thumbnail than page with strokes", async () => {
      // Create two pages in the same notebook
      const nb = await app.inject({
        method: "POST",
        url: "/api/notebooks",
        payload: { title: "Comparison Test" },
      });
      const notebookId = nb.json().id;

      const pg1 = await app.inject({
        method: "POST",
        url: `/api/notebooks/${notebookId}/pages`,
      });
      const blankPageId = pg1.json().id;

      const pg2 = await app.inject({
        method: "POST",
        url: `/api/notebooks/${notebookId}/pages`,
      });
      const strokesPageId = pg2.json().id;

      // Add strokes to second page only
      await app.inject({
        method: "POST",
        url: `/api/pages/${strokesPageId}/strokes`,
        payload: {
          strokes: [
            makeStroke("st_1"),
            makeStroke("st_2", {
              color: "#ff0000",
              width: 10,
              points: [
                { x: 500, y: 500, pressure: 0.8 },
                { x: 600, y: 600, pressure: 0.8 },
                { x: 700, y: 700, pressure: 0.8 },
              ],
            }),
          ],
        },
      });

      const blankRes = await app.inject({
        method: "GET",
        url: `/api/pages/${blankPageId}/thumbnail`,
      });

      const strokesRes = await app.inject({
        method: "GET",
        url: `/api/pages/${strokesPageId}/thumbnail`,
      });

      expect(blankRes.statusCode).toBe(200);
      expect(strokesRes.statusCode).toBe(200);

      // Thumbnails should differ
      expect(Buffer.compare(blankRes.rawPayload, strokesRes.rawPayload)).not.toBe(0);
    });

    it("more strokes produce different thumbnail", async () => {
      const { pageId } = await createNotebookWithPage();

      // Get thumbnail with one stroke
      await addStrokes(pageId, 1);
      const oneStroke = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      // Force regeneration by adding more strokes
      // The cached thumbnail will still be served, so we need to invalidate it
      // by adding the strokes and making a new page for a fair comparison

      const nb = await app.inject({
        method: "POST",
        url: "/api/notebooks",
        payload: { title: "Multi-stroke Test" },
      });
      const notebookId = nb.json().id;

      const pg = await app.inject({
        method: "POST",
        url: `/api/notebooks/${notebookId}/pages`,
      });
      const manyStrokesPageId = pg.json().id;

      await app.inject({
        method: "POST",
        url: `/api/pages/${manyStrokesPageId}/strokes`,
        payload: {
          strokes: Array.from({ length: 10 }, (_, i) =>
            makeStroke(`st_${i + 1}`, {
              color: i % 2 === 0 ? "#000000" : "#ff0000",
              points: [
                { x: 100 + i * 50, y: 100, pressure: 0.5 },
                { x: 100 + i * 50, y: 500, pressure: 0.7 },
                { x: 200 + i * 50, y: 300, pressure: 0.6 },
              ],
            }),
          ),
        },
      });

      const manyStrokes = await app.inject({
        method: "GET",
        url: `/api/pages/${manyStrokesPageId}/thumbnail`,
      });

      expect(oneStroke.statusCode).toBe(200);
      expect(manyStrokes.statusCode).toBe(200);

      // Different content should produce different thumbnails
      expect(Buffer.compare(oneStroke.rawPayload, manyStrokes.rawPayload)).not.toBe(0);
    });
  });

  describe("response headers", () => {
    it("does not set Content-Disposition header (inline display)", async () => {
      const { pageId } = await createNotebookWithPage();

      const res = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      expect(res.statusCode).toBe(200);
      // Thumbnails should be displayed inline, not downloaded
      expect(res.headers["content-disposition"]).toBeUndefined();
    });

    it("returns proper content length", async () => {
      const { pageId } = await createNotebookWithPage();
      await addStrokes(pageId, 2);

      const res = await app.inject({
        method: "GET",
        url: `/api/pages/${pageId}/thumbnail`,
      });

      expect(res.statusCode).toBe(200);
      // Content-Length should match actual payload size
      const contentLength = parseInt(res.headers["content-length"] as string, 10);
      expect(contentLength).toBe(res.rawPayload.length);
    });
  });
});

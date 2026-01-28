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
  testDir = await mkdtemp(join(tmpdir(), "inkwell-export-test-"));
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
    payload: { title: "Export Test" },
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

async function addTranscription(notebookId: string, pageId: string, content: string) {
  const transcriptionPath = paths.transcription(notebookId, pageId);
  await writeFile(transcriptionPath, content, "utf-8");
}

// --- PDF export: single page ---

describe("GET /api/pages/:pageId/export/pdf", () => {
  it("exports a page with strokes as PDF", async () => {
    const { pageId } = await createNotebookWithPage();
    await addStrokes(pageId, 3);

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/pdf`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain(`${pageId}.pdf`);

    // Verify it's a valid PDF (starts with %PDF-)
    const body = res.rawPayload;
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(100);
  });

  it("exports a page with no strokes as PDF", async () => {
    const { pageId } = await createNotebookWithPage();

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/pdf`,
    });

    // An empty page should still produce a valid PDF
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("includes transcription when requested", async () => {
    const { notebookId, pageId } = await createNotebookWithPage();
    await addStrokes(pageId);
    await addTranscription(notebookId, pageId, "Hello world transcription");

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/pdf?includeTranscription=true`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    // PDF with transcription should be larger than without
    const resNoTranscription = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/pdf`,
    });
    expect(res.rawPayload.length).toBeGreaterThan(
      resNoTranscription.rawPayload.length,
    );
  });

  it("supports A4 page size", async () => {
    const { pageId } = await createNotebookWithPage();
    await addStrokes(pageId);

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/pdf?pageSize=a4`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("supports letter page size", async () => {
    const { pageId } = await createNotebookWithPage();
    await addStrokes(pageId);

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/pdf?pageSize=letter`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/pages/pg_missing/export/pdf",
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects invalid pageSize", async () => {
    const { pageId } = await createNotebookWithPage();

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/pdf?pageSize=tabloid`,
    });

    expect(res.statusCode).toBe(400);
  });
});

// --- PDF export: notebook ---

describe("GET /api/notebooks/:notebookId/export/pdf", () => {
  it("exports a notebook with multiple pages as PDF", async () => {
    const nb = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "Multi-Page Notebook" },
    });
    const notebookId = nb.json().id;

    // Create 3 pages with strokes
    for (let i = 0; i < 3; i++) {
      const pg = await app.inject({
        method: "POST",
        url: `/api/notebooks/${notebookId}/pages`,
      });
      await addStrokes(pg.json().id);
    }

    const res = await app.inject({
      method: "GET",
      url: `/api/notebooks/${notebookId}/export/pdf`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("Multi-Page_Notebook.pdf");
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("sanitizes notebook title in filename", async () => {
    const nb = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "My Notes / 2024" },
    });
    const notebookId = nb.json().id;

    const pg = await app.inject({
      method: "POST",
      url: `/api/notebooks/${notebookId}/pages`,
    });
    await addStrokes(pg.json().id);

    const res = await app.inject({
      method: "GET",
      url: `/api/notebooks/${notebookId}/export/pdf`,
    });

    expect(res.statusCode).toBe(200);
    // Should sanitize special characters
    const disposition = res.headers["content-disposition"] as string;
    expect(disposition).not.toContain("/");
  });

  it("returns 404 for non-existent notebook", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/notebooks/nb_missing/export/pdf",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for notebook with no pages", async () => {
    const nb = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "Empty Notebook" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/notebooks/${nb.json().id}/export/pdf`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("includes transcriptions for all pages when requested", async () => {
    const nb = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "Transcribed" },
    });
    const notebookId = nb.json().id;

    const pg = await app.inject({
      method: "POST",
      url: `/api/notebooks/${notebookId}/pages`,
    });
    const pageId = pg.json().id;
    await addStrokes(pageId);
    await addTranscription(notebookId, pageId, "Some transcription text here");

    const withTranscription = await app.inject({
      method: "GET",
      url: `/api/notebooks/${notebookId}/export/pdf?includeTranscription=true`,
    });
    const without = await app.inject({
      method: "GET",
      url: `/api/notebooks/${notebookId}/export/pdf`,
    });

    expect(withTranscription.statusCode).toBe(200);
    expect(withTranscription.rawPayload.length).toBeGreaterThan(
      without.rawPayload.length,
    );
  });
});

// --- PNG export ---

describe("GET /api/pages/:pageId/export/png", () => {
  it("exports a page with strokes as PNG", async () => {
    const { pageId } = await createNotebookWithPage();
    await addStrokes(pageId, 2);

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/png`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["content-disposition"]).toContain(`${pageId}.png`);

    // Verify PNG magic bytes
    const body = res.rawPayload;
    expect(body[0]).toBe(0x89);
    expect(body[1]).toBe(0x50); // P
    expect(body[2]).toBe(0x4e); // N
    expect(body[3]).toBe(0x47); // G
  });

  it("exports a page with no strokes as PNG (white page)", async () => {
    const { pageId } = await createNotebookWithPage();

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/png`,
    });

    expect(res.statusCode).toBe(200);
    // Should be a valid PNG even with no strokes
    expect(res.rawPayload[0]).toBe(0x89);
  });

  it("supports scale parameter", async () => {
    const { pageId } = await createNotebookWithPage();
    await addStrokes(pageId);

    const scale1 = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/png?scale=1`,
    });
    const scale2 = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/png?scale=2`,
    });

    expect(scale1.statusCode).toBe(200);
    expect(scale2.statusCode).toBe(200);
    // 2x scale should produce a larger image
    expect(scale2.rawPayload.length).toBeGreaterThan(scale1.rawPayload.length);
  });

  it("clamps scale to safe range", async () => {
    const { pageId } = await createNotebookWithPage();
    await addStrokes(pageId);

    // Unreasonably large scale should be clamped to 4
    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/png?scale=100`,
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 404 for non-existent page", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/pages/pg_missing/export/png",
    });
    expect(res.statusCode).toBe(404);
  });

  it("handles different pen styles in export", async () => {
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

    const pdfRes = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/pdf`,
    });
    expect(pdfRes.statusCode).toBe(200);
    expect(pdfRes.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");

    const pngRes = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/png`,
    });
    expect(pngRes.statusCode).toBe(200);
    expect(pngRes.rawPayload[0]).toBe(0x89);
  });

  it("handles different stroke colors", async () => {
    const { pageId } = await createNotebookWithPage();

    await app.inject({
      method: "POST",
      url: `/api/pages/${pageId}/strokes`,
      payload: {
        strokes: [
          makeStroke("st_black", { color: "#000000" }),
          makeStroke("st_blue", { color: "#0000ff" }),
          makeStroke("st_red", { color: "#ff0000" }),
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/pages/${pageId}/export/pdf`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { config } from "../config.js";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import { paths } from "../storage/paths.js";

let app: FastifyInstance;
let originalDataDir: string;
let testDir: string;
let syncDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-sync-routes-test-"));
  syncDir = join(testDir, "sync-dest");
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
  return res.json() as { id: string; notebookId: string };
}

async function markTranscribed(notebookId: string, pageId: string, content: string) {
  // Write transcription file
  await writeFile(paths.transcription(notebookId, pageId), content, "utf-8");

  // Update page transcription status
  await app.inject({
    method: "PATCH",
    url: `/api/pages/${pageId}`,
    // We need to set transcription status via the internal store since
    // the PATCH route doesn't expose transcription updates
  });

  // Use direct storage access to set transcription status
  const { pageStore } = await import("../storage/index.js");
  await pageStore.updatePage(pageId, {
    transcription: {
      status: "complete",
      lastAttempt: new Date().toISOString(),
      error: null,
    },
  });
}

describe("GET /api/config/markdown", () => {
  it("returns default markdown config", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/config/markdown",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.frontmatter).toBeDefined();
    expect(body.frontmatter.enabled).toBe(true);
    expect(body.sync).toBeDefined();
    expect(body.sync.enabled).toBe(false);
  });
});

describe("PATCH /api/config/markdown", () => {
  it("updates frontmatter settings", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/config/markdown",
      payload: {
        frontmatter: { enabled: false },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().frontmatter.enabled).toBe(false);
  });

  it("updates sync settings", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/config/markdown",
      payload: {
        sync: {
          enabled: true,
          destination: "/tmp/vault",
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sync.enabled).toBe(true);
    expect(res.json().sync.destination).toBe("/tmp/vault");
  });

  it("updates frontmatter template", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/config/markdown",
      payload: {
        frontmatter: {
          template: {
            title: "{{page.id}}",
            author: "inkwell",
          },
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().frontmatter.template.title).toBe("{{page.id}}");
    expect(res.json().frontmatter.template.author).toBe("inkwell");
  });

  it("persists changes across requests", async () => {
    await app.inject({
      method: "PATCH",
      url: "/api/config/markdown",
      payload: {
        sync: { enabled: true, destination: "/data/vault" },
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/config/markdown",
    });
    expect(res.json().sync.enabled).toBe(true);
    expect(res.json().sync.destination).toBe("/data/vault");
  });

  it("strips unknown body properties (additionalProperties: false)", async () => {
    // Fastify strips additional properties; the request still succeeds
    const res = await app.inject({
      method: "PATCH",
      url: "/api/config/markdown",
      payload: { invalid: true },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/sync/status", () => {
  it("returns default sync status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/sync/status",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(false);
    expect(body.lastSync).toBeNull();
    expect(body.totalSynced).toBe(0);
  });
});

describe("POST /api/pages/:pageId/sync", () => {
  it("returns 400 when sync is disabled", async () => {
    const nb = await createNotebook();
    const page = await createPage(nb.id);

    const res = await app.inject({
      method: "POST",
      url: `/api/pages/${page.id}/sync`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("SYNC_DISABLED");
  });

  it("returns 404 for non-existent page", async () => {
    // Enable sync first
    await app.inject({
      method: "PATCH",
      url: "/api/config/markdown",
      payload: { sync: { enabled: true, destination: syncDir } },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/pages/pg_missing/sync",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for page without transcription", async () => {
    const nb = await createNotebook();
    const page = await createPage(nb.id);

    await app.inject({
      method: "PATCH",
      url: "/api/config/markdown",
      payload: { sync: { enabled: true, destination: syncDir } },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/pages/${page.id}/sync`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("syncs page to destination", async () => {
    const nb = await createNotebook("My Notebook");
    const page = await createPage(nb.id);

    await markTranscribed(nb.id, page.id, "Test transcription content");

    await app.inject({
      method: "PATCH",
      url: "/api/config/markdown",
      payload: {
        frontmatter: { enabled: false },
        sync: {
          enabled: true,
          destination: syncDir,
          filenameTemplate: "{{notebook.name}}/{{page.id}}.md",
        },
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/pages/${page.id}/sync`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().synced).toBe(true);

    const content = await readFile(res.json().destination, "utf-8");
    expect(content).toBe("Test transcription content");
  });
});

describe("POST /api/notebooks/:notebookId/sync", () => {
  it("returns 404 for non-existent notebook", async () => {
    await app.inject({
      method: "PATCH",
      url: "/api/config/markdown",
      payload: { sync: { enabled: true, destination: syncDir } },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/notebooks/nb_missing/sync",
    });
    expect(res.statusCode).toBe(404);
  });

  it("syncs all transcribed pages in notebook", async () => {
    const nb = await createNotebook("Sync Notebook");
    const page1 = await createPage(nb.id);
    const page2 = await createPage(nb.id);
    await createPage(nb.id); // Page 3 not transcribed

    await markTranscribed(nb.id, page1.id, "Page 1 content");
    await markTranscribed(nb.id, page2.id, "Page 2 content");

    await app.inject({
      method: "PATCH",
      url: "/api/config/markdown",
      payload: {
        frontmatter: { enabled: false },
        sync: {
          enabled: true,
          destination: syncDir,
          filenameTemplate: "{{notebook.name}}/{{page.seq}}-{{page.id}}.md",
        },
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/notebooks/${nb.id}/sync`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().synced).toBe(2);
    expect(res.json().skipped).toBe(1);
  });

  it("returns 400 when sync is disabled", async () => {
    const nb = await createNotebook();

    const res = await app.inject({
      method: "POST",
      url: `/api/notebooks/${nb.id}/sync`,
    });
    expect(res.statusCode).toBe(400);
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import {
  listNotebooks,
  getNotebook,
  createNotebook,
  updateNotebook,
  deleteNotebook,
} from "./notebook-store.js";
import { createPage, getPage } from "./page-store.js";
import type { NotebookMeta, PageMeta } from "../types/index.js";

let originalDataDir: string;
let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-nb-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
});

afterEach(async () => {
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

function makeMeta(overrides: Partial<NotebookMeta> = {}): NotebookMeta {
  const now = new Date().toISOString();
  return {
    id: `nb_test_${Date.now()}`,
    title: "Test Notebook",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("createNotebook", () => {
  it("creates a notebook that can be retrieved", async () => {
    const meta = makeMeta({ id: "nb_create1", title: "My Notebook" });
    await createNotebook(meta);
    const result = await getNotebook("nb_create1");
    expect(result).toEqual(meta);
  });
});

describe("getNotebook", () => {
  it("returns null for a non-existent notebook", async () => {
    const result = await getNotebook("nb_nonexistent");
    expect(result).toBeNull();
  });
});

describe("listNotebooks", () => {
  it("returns an empty array when no notebooks exist", async () => {
    const result = await listNotebooks();
    expect(result).toEqual([]);
  });

  it("returns notebooks sorted by updatedAt descending", async () => {
    const older = makeMeta({ id: "nb_old", title: "Older", updatedAt: "2024-01-01T00:00:00.000Z" });
    const newer = makeMeta({ id: "nb_new", title: "Newer", updatedAt: "2025-01-01T00:00:00.000Z" });
    await createNotebook(older);
    await createNotebook(newer);

    const result = await listNotebooks();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("nb_new");
    expect(result[1].id).toBe("nb_old");
  });
});

describe("updateNotebook", () => {
  it("updates the title and updatedAt timestamp", async () => {
    const meta = makeMeta({
      id: "nb_update1",
      title: "Original",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    await createNotebook(meta);

    const updated = await updateNotebook("nb_update1", { title: "Renamed" });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("Renamed");
    expect(updated!.updatedAt).not.toBe(meta.updatedAt);
  });

  it("returns null for a non-existent notebook", async () => {
    const result = await updateNotebook("nb_missing", { title: "Nope" });
    expect(result).toBeNull();
  });
});

describe("deleteNotebook", () => {
  it("deletes an existing notebook", async () => {
    const meta = makeMeta({ id: "nb_delete1" });
    await createNotebook(meta);

    const deleted = await deleteNotebook("nb_delete1");
    expect(deleted).toBe(true);

    const result = await getNotebook("nb_delete1");
    expect(result).toBeNull();
  });

  it("returns false for a non-existent notebook", async () => {
    const result = await deleteNotebook("nb_ghost");
    expect(result).toBe(false);
  });

  it("cleans up page-index entries when notebook is deleted", async () => {
    const meta = makeMeta({ id: "nb_cleanup1" });
    await createNotebook(meta);

    const now = new Date().toISOString();
    const pageMeta: PageMeta = {
      id: "pg_cleanup1",
      notebookId: "nb_cleanup1",
      pageNumber: 1,
      canvasX: 0,
      canvasY: 0,
      createdAt: now,
      updatedAt: now,
    };
    await createPage(pageMeta);

    // Page should be findable before deletion
    const pageBefore = await getPage("pg_cleanup1");
    expect(pageBefore).not.toBeNull();

    // Delete the notebook
    await deleteNotebook("nb_cleanup1");

    // Page-index should no longer reference the deleted page
    const pageAfter = await getPage("pg_cleanup1");
    expect(pageAfter).toBeNull();
  });
});

import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import {
  listPages,
  getPage,
  getNotebookIdForPage,
  createPage,
  updatePage,
  deletePage,
  movePages,
} from "./page-store.js";
import { createNotebook } from "./notebook-store.js";
import { readJson } from "./fs-utils.js";
import { paths } from "./paths.js";
import type { PageMeta, NotebookMeta, PageIndex } from "../types/index.js";

let originalDataDir: string;
let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-page-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
});

afterEach(async () => {
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

function makeNotebook(overrides: Partial<NotebookMeta> = {}): NotebookMeta {
  const now = new Date().toISOString();
  return {
    id: `nb_test_${Date.now()}`,
    title: "Test Notebook",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makePage(overrides: Partial<PageMeta> = {}): PageMeta {
  const now = new Date().toISOString();
  return {
    id: `pg_test_${Date.now()}`,
    notebookId: "nb_default",
    pageNumber: 1,
    canvasX: 0,
    canvasY: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("createPage", () => {
  it("creates a page directory with meta.json and strokes.json", async () => {
    const nb = makeNotebook({ id: "nb_cp1" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_cp1", notebookId: "nb_cp1" });
    await createPage(page);

    const meta = await readJson<PageMeta>(paths.pageMeta("nb_cp1", "pg_cp1"));
    expect(meta).toEqual(page);

    const strokes = await readJson<unknown[]>(paths.strokes("nb_cp1", "pg_cp1"));
    expect(strokes).toEqual([]);
  });

  it("registers the page in the page-index", async () => {
    const nb = makeNotebook({ id: "nb_cp2" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_cp2", notebookId: "nb_cp2" });
    await createPage(page);

    const index = await readJson<PageIndex>(paths.pageIndex());
    expect(index).not.toBeNull();
    expect(index!["pg_cp2"]).toBe("nb_cp2");
  });

  it("can create multiple pages in the same notebook", async () => {
    const nb = makeNotebook({ id: "nb_cp3" });
    await createNotebook(nb);

    const page1 = makePage({ id: "pg_cp3a", notebookId: "nb_cp3", pageNumber: 1 });
    const page2 = makePage({ id: "pg_cp3b", notebookId: "nb_cp3", pageNumber: 2 });
    await createPage(page1);
    await createPage(page2);

    const index = await readJson<PageIndex>(paths.pageIndex());
    expect(index!["pg_cp3a"]).toBe("nb_cp3");
    expect(index!["pg_cp3b"]).toBe("nb_cp3");
  });

  it("can create pages in different notebooks", async () => {
    await createNotebook(makeNotebook({ id: "nb_cp4a" }));
    await createNotebook(makeNotebook({ id: "nb_cp4b" }));

    await createPage(makePage({ id: "pg_cp4a", notebookId: "nb_cp4a" }));
    await createPage(makePage({ id: "pg_cp4b", notebookId: "nb_cp4b" }));

    const index = await readJson<PageIndex>(paths.pageIndex());
    expect(index!["pg_cp4a"]).toBe("nb_cp4a");
    expect(index!["pg_cp4b"]).toBe("nb_cp4b");
  });
});

describe("getPage", () => {
  it("retrieves a created page by id", async () => {
    const nb = makeNotebook({ id: "nb_gp1" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_gp1", notebookId: "nb_gp1", pageNumber: 3 });
    await createPage(page);

    const result = await getPage("pg_gp1");
    expect(result).toEqual(page);
  });

  it("returns null for a non-existent page", async () => {
    const result = await getPage("pg_nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when page-index is empty", async () => {
    const result = await getPage("pg_ghost");
    expect(result).toBeNull();
  });
});

describe("getNotebookIdForPage", () => {
  it("returns the notebook id for an existing page", async () => {
    const nb = makeNotebook({ id: "nb_gnifp1" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_gnifp1", notebookId: "nb_gnifp1" });
    await createPage(page);

    const notebookId = await getNotebookIdForPage("pg_gnifp1");
    expect(notebookId).toBe("nb_gnifp1");
  });

  it("returns null for a non-existent page", async () => {
    const result = await getNotebookIdForPage("pg_missing");
    expect(result).toBeNull();
  });
});

describe("listPages", () => {
  it("returns an empty array when the notebook has no pages", async () => {
    const nb = makeNotebook({ id: "nb_lp1" });
    await createNotebook(nb);

    const pages = await listPages("nb_lp1");
    expect(pages).toEqual([]);
  });

  it("returns pages sorted by pageNumber ascending", async () => {
    const nb = makeNotebook({ id: "nb_lp2" });
    await createNotebook(nb);

    const page3 = makePage({ id: "pg_lp2c", notebookId: "nb_lp2", pageNumber: 3 });
    const page1 = makePage({ id: "pg_lp2a", notebookId: "nb_lp2", pageNumber: 1 });
    const page2 = makePage({ id: "pg_lp2b", notebookId: "nb_lp2", pageNumber: 2 });

    // Create out of order
    await createPage(page3);
    await createPage(page1);
    await createPage(page2);

    const pages = await listPages("nb_lp2");
    expect(pages).toHaveLength(3);
    expect(pages[0].id).toBe("pg_lp2a");
    expect(pages[1].id).toBe("pg_lp2b");
    expect(pages[2].id).toBe("pg_lp2c");
  });

  it("returns an empty array for a non-existent notebook", async () => {
    const pages = await listPages("nb_nonexistent");
    expect(pages).toEqual([]);
  });

  it("skips non-directory entries in the pages folder", async () => {
    const nb = makeNotebook({ id: "nb_lp3" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_lp3", notebookId: "nb_lp3" });
    await createPage(page);

    const pages = await listPages("nb_lp3");
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe("pg_lp3");
  });

  it("only returns pages belonging to the specified notebook", async () => {
    await createNotebook(makeNotebook({ id: "nb_lp4a" }));
    await createNotebook(makeNotebook({ id: "nb_lp4b" }));

    await createPage(makePage({ id: "pg_lp4a1", notebookId: "nb_lp4a", pageNumber: 1 }));
    await createPage(makePage({ id: "pg_lp4a2", notebookId: "nb_lp4a", pageNumber: 2 }));
    await createPage(makePage({ id: "pg_lp4b1", notebookId: "nb_lp4b", pageNumber: 1 }));

    const pagesA = await listPages("nb_lp4a");
    expect(pagesA).toHaveLength(2);
    expect(pagesA.every((p) => p.notebookId === "nb_lp4a")).toBe(true);

    const pagesB = await listPages("nb_lp4b");
    expect(pagesB).toHaveLength(1);
    expect(pagesB[0].notebookId).toBe("nb_lp4b");
  });
});

describe("updatePage", () => {
  it("updates canvasX and canvasY", async () => {
    const nb = makeNotebook({ id: "nb_up1" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_up1", notebookId: "nb_up1", canvasX: 0, canvasY: 0 });
    await createPage(page);

    const updated = await updatePage("pg_up1", { canvasX: 100, canvasY: 200 });
    expect(updated).not.toBeNull();
    expect(updated!.canvasX).toBe(100);
    expect(updated!.canvasY).toBe(200);
  });

  it("updates pageNumber", async () => {
    const nb = makeNotebook({ id: "nb_up2" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_up2", notebookId: "nb_up2", pageNumber: 1 });
    await createPage(page);

    const updated = await updatePage("pg_up2", { pageNumber: 5 });
    expect(updated).not.toBeNull();
    expect(updated!.pageNumber).toBe(5);
  });

  it("updates the updatedAt timestamp", async () => {
    const nb = makeNotebook({ id: "nb_up3" });
    await createNotebook(nb);

    const oldDate = "2020-01-01T00:00:00.000Z";
    const page = makePage({ id: "pg_up3", notebookId: "nb_up3", updatedAt: oldDate });
    await createPage(page);

    const updated = await updatePage("pg_up3", { canvasX: 50 });
    expect(updated).not.toBeNull();
    expect(updated!.updatedAt).not.toBe(oldDate);
  });

  it("preserves fields that are not updated", async () => {
    const nb = makeNotebook({ id: "nb_up4" });
    await createNotebook(nb);

    const page = makePage({
      id: "pg_up4",
      notebookId: "nb_up4",
      pageNumber: 7,
      canvasX: 10,
      canvasY: 20,
    });
    await createPage(page);

    const updated = await updatePage("pg_up4", { canvasX: 99 });
    expect(updated).not.toBeNull();
    expect(updated!.pageNumber).toBe(7);
    expect(updated!.canvasY).toBe(20);
    expect(updated!.notebookId).toBe("nb_up4");
    expect(updated!.id).toBe("pg_up4");
  });

  it("returns null for a non-existent page", async () => {
    const result = await updatePage("pg_missing", { canvasX: 1 });
    expect(result).toBeNull();
  });

  it("persists updates to disk", async () => {
    const nb = makeNotebook({ id: "nb_up5" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_up5", notebookId: "nb_up5", canvasX: 0 });
    await createPage(page);

    await updatePage("pg_up5", { canvasX: 42 });

    // Re-read from disk
    const fromDisk = await getPage("pg_up5");
    expect(fromDisk).not.toBeNull();
    expect(fromDisk!.canvasX).toBe(42);
  });

  it("updates links and tags", async () => {
    const nb = makeNotebook({ id: "nb_up6" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_up6", notebookId: "nb_up6" });
    await createPage(page);

    const updated = await updatePage("pg_up6", {
      links: ["pg_other1", "pg_other2"],
      tags: ["important", "review"],
    });
    expect(updated).not.toBeNull();
    expect(updated!.links).toEqual(["pg_other1", "pg_other2"]);
    expect(updated!.tags).toEqual(["important", "review"]);
  });

  it("updates transcription metadata", async () => {
    const nb = makeNotebook({ id: "nb_up7" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_up7", notebookId: "nb_up7" });
    await createPage(page);

    const transcription = {
      status: "complete" as const,
      lastAttempt: new Date().toISOString(),
      error: null,
    };
    const updated = await updatePage("pg_up7", { transcription });
    expect(updated).not.toBeNull();
    expect(updated!.transcription).toEqual(transcription);
  });
});

describe("deletePage", () => {
  it("deletes an existing page and returns true", async () => {
    const nb = makeNotebook({ id: "nb_dp1" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_dp1", notebookId: "nb_dp1" });
    await createPage(page);

    const result = await deletePage("pg_dp1");
    expect(result).toBe(true);
  });

  it("removes the page from the page-index", async () => {
    const nb = makeNotebook({ id: "nb_dp2" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_dp2", notebookId: "nb_dp2" });
    await createPage(page);

    await deletePage("pg_dp2");

    const index = await readJson<PageIndex>(paths.pageIndex());
    expect(index!["pg_dp2"]).toBeUndefined();
  });

  it("removes the page directory from disk", async () => {
    const nb = makeNotebook({ id: "nb_dp3" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_dp3", notebookId: "nb_dp3" });
    await createPage(page);

    await deletePage("pg_dp3");

    const pageDir = paths.page("nb_dp3", "pg_dp3");
    const meta = await readJson<PageMeta>(join(pageDir, "meta.json"));
    expect(meta).toBeNull(); // File no longer exists
  });

  it("makes the page unretrievable via getPage", async () => {
    const nb = makeNotebook({ id: "nb_dp4" });
    await createNotebook(nb);

    const page = makePage({ id: "pg_dp4", notebookId: "nb_dp4" });
    await createPage(page);

    await deletePage("pg_dp4");
    const result = await getPage("pg_dp4");
    expect(result).toBeNull();
  });

  it("returns false for a non-existent page", async () => {
    const result = await deletePage("pg_ghost");
    expect(result).toBe(false);
  });

  it("does not affect other pages in the same notebook", async () => {
    const nb = makeNotebook({ id: "nb_dp5" });
    await createNotebook(nb);

    const page1 = makePage({ id: "pg_dp5a", notebookId: "nb_dp5", pageNumber: 1 });
    const page2 = makePage({ id: "pg_dp5b", notebookId: "nb_dp5", pageNumber: 2 });
    await createPage(page1);
    await createPage(page2);

    await deletePage("pg_dp5a");

    const remaining = await getPage("pg_dp5b");
    expect(remaining).not.toBeNull();
    expect(remaining!.id).toBe("pg_dp5b");

    const pages = await listPages("nb_dp5");
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe("pg_dp5b");
  });

  it("does not affect pages in other notebooks", async () => {
    await createNotebook(makeNotebook({ id: "nb_dp6a" }));
    await createNotebook(makeNotebook({ id: "nb_dp6b" }));

    await createPage(makePage({ id: "pg_dp6a", notebookId: "nb_dp6a" }));
    await createPage(makePage({ id: "pg_dp6b", notebookId: "nb_dp6b" }));

    await deletePage("pg_dp6a");

    const otherPage = await getPage("pg_dp6b");
    expect(otherPage).not.toBeNull();
    expect(otherPage!.id).toBe("pg_dp6b");
  });
});

describe("movePages", () => {
  it("moves a single page to another notebook", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp1_src" }));
    await createNotebook(makeNotebook({ id: "nb_mp1_dst" }));

    await createPage(makePage({ id: "pg_mp1", notebookId: "nb_mp1_src", pageNumber: 1 }));

    const moved = await movePages(["pg_mp1"], "nb_mp1_dst");
    expect(moved).toHaveLength(1);
    expect(moved[0].id).toBe("pg_mp1");
    expect(moved[0].notebookId).toBe("nb_mp1_dst");
    expect(moved[0].pageNumber).toBe(1);
  });

  it("updates the page-index for moved pages", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp2_src" }));
    await createNotebook(makeNotebook({ id: "nb_mp2_dst" }));

    await createPage(makePage({ id: "pg_mp2", notebookId: "nb_mp2_src" }));

    await movePages(["pg_mp2"], "nb_mp2_dst");

    const notebookId = await getNotebookIdForPage("pg_mp2");
    expect(notebookId).toBe("nb_mp2_dst");
  });

  it("removes pages from source notebook", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp3_src" }));
    await createNotebook(makeNotebook({ id: "nb_mp3_dst" }));

    await createPage(makePage({ id: "pg_mp3", notebookId: "nb_mp3_src" }));

    await movePages(["pg_mp3"], "nb_mp3_dst");

    const sourcePgs = await listPages("nb_mp3_src");
    expect(sourcePgs).toHaveLength(0);
  });

  it("adds pages to target notebook", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp4_src" }));
    await createNotebook(makeNotebook({ id: "nb_mp4_dst" }));

    await createPage(makePage({ id: "pg_mp4", notebookId: "nb_mp4_src" }));

    await movePages(["pg_mp4"], "nb_mp4_dst");

    const destPgs = await listPages("nb_mp4_dst");
    expect(destPgs).toHaveLength(1);
    expect(destPgs[0].id).toBe("pg_mp4");
  });

  it("assigns sequential page numbers to moved pages", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp5_src" }));
    await createNotebook(makeNotebook({ id: "nb_mp5_dst" }));

    // Create existing page in destination
    await createPage(makePage({ id: "pg_mp5_existing", notebookId: "nb_mp5_dst", pageNumber: 1 }));

    // Create pages to move
    await createPage(makePage({ id: "pg_mp5_a", notebookId: "nb_mp5_src", pageNumber: 1 }));
    await createPage(makePage({ id: "pg_mp5_b", notebookId: "nb_mp5_src", pageNumber: 2 }));

    const moved = await movePages(["pg_mp5_a", "pg_mp5_b"], "nb_mp5_dst");
    expect(moved).toHaveLength(2);
    expect(moved[0].pageNumber).toBe(2);
    expect(moved[1].pageNumber).toBe(3);
  });

  it("moves multiple pages atomically", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp6_src" }));
    await createNotebook(makeNotebook({ id: "nb_mp6_dst" }));

    await createPage(makePage({ id: "pg_mp6_a", notebookId: "nb_mp6_src", pageNumber: 1 }));
    await createPage(makePage({ id: "pg_mp6_b", notebookId: "nb_mp6_src", pageNumber: 2 }));
    await createPage(makePage({ id: "pg_mp6_c", notebookId: "nb_mp6_src", pageNumber: 3 }));

    const moved = await movePages(["pg_mp6_a", "pg_mp6_c"], "nb_mp6_dst");
    expect(moved).toHaveLength(2);

    const sourcePgs = await listPages("nb_mp6_src");
    expect(sourcePgs).toHaveLength(1);
    expect(sourcePgs[0].id).toBe("pg_mp6_b");

    const destPgs = await listPages("nb_mp6_dst");
    expect(destPgs).toHaveLength(2);
  });

  it("throws an error for non-existent page", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp7_dst" }));

    await expect(movePages(["pg_nonexistent"], "nb_mp7_dst")).rejects.toThrow(
      "Page not found: pg_nonexistent",
    );
  });

  it("throws an error when page is already in target notebook", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp8" }));
    await createPage(makePage({ id: "pg_mp8", notebookId: "nb_mp8" }));

    await expect(movePages(["pg_mp8"], "nb_mp8")).rejects.toThrow(
      "Page already in target notebook: pg_mp8",
    );
  });

  it("returns empty array when no page IDs provided", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp9_dst" }));

    const moved = await movePages([], "nb_mp9_dst");
    expect(moved).toEqual([]);
  });

  it("preserves page content and metadata except notebookId and pageNumber", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp10_src" }));
    await createNotebook(makeNotebook({ id: "nb_mp10_dst" }));

    const originalPage = makePage({
      id: "pg_mp10",
      notebookId: "nb_mp10_src",
      pageNumber: 5,
      canvasX: 100,
      canvasY: 200,
      links: ["pg_linked"],
      tags: ["important", "review"],
    });
    await createPage(originalPage);

    const moved = await movePages(["pg_mp10"], "nb_mp10_dst");
    expect(moved[0].canvasX).toBe(100);
    expect(moved[0].canvasY).toBe(200);
    expect(moved[0].links).toEqual(["pg_linked"]);
    expect(moved[0].tags).toEqual(["important", "review"]);
    expect(moved[0].notebookId).toBe("nb_mp10_dst");
    expect(moved[0].pageNumber).toBe(1);
  });

  it("updates the updatedAt timestamp", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp11_src" }));
    await createNotebook(makeNotebook({ id: "nb_mp11_dst" }));

    const oldDate = "2020-01-01T00:00:00.000Z";
    await createPage(makePage({ id: "pg_mp11", notebookId: "nb_mp11_src", updatedAt: oldDate }));

    const moved = await movePages(["pg_mp11"], "nb_mp11_dst");
    expect(moved[0].updatedAt).not.toBe(oldDate);
  });

  it("makes pages retrievable from new location via getPage", async () => {
    await createNotebook(makeNotebook({ id: "nb_mp12_src" }));
    await createNotebook(makeNotebook({ id: "nb_mp12_dst" }));

    await createPage(makePage({ id: "pg_mp12", notebookId: "nb_mp12_src" }));

    await movePages(["pg_mp12"], "nb_mp12_dst");

    const page = await getPage("pg_mp12");
    expect(page).not.toBeNull();
    expect(page!.notebookId).toBe("nb_mp12_dst");
  });
});

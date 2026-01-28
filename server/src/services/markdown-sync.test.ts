import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { config } from "../config.js";
import { createNotebook } from "../storage/notebook-store.js";
import { createPage, updatePage } from "../storage/page-store.js";
import { updateMarkdownConfig } from "../storage/config-store.js";
import { paths } from "../storage/paths.js";
import {
  syncPage,
  syncNotebook,
  regenerateFrontmatter,
  stripFrontmatter,
  SyncError,
} from "./markdown-sync.js";
import type { PageMeta } from "../types/index.js";

let originalDataDir: string;
let testDir: string;
let syncDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-sync-test-"));
  syncDir = join(testDir, "sync-dest");
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
});

afterEach(async () => {
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

async function setupNotebookAndPage(opts?: {
  tags?: string[];
  transcriptionContent?: string;
}): Promise<{ notebookId: string; pageId: string }> {
  const notebookId = "nb_test1";
  const pageId = "pg_test1";
  const now = new Date().toISOString();

  await createNotebook({
    id: notebookId,
    title: "Test Notebook",
    createdAt: now,
    updatedAt: now,
  });

  const pageMeta: PageMeta = {
    id: pageId,
    notebookId,
    pageNumber: 1,
    canvasX: 0,
    canvasY: 0,
    createdAt: now,
    updatedAt: now,
    tags: opts?.tags ?? [],
    transcription: {
      status: "complete",
      lastAttempt: now,
      error: null,
    },
  };
  await createPage(pageMeta);

  // Write transcription file
  const content = opts?.transcriptionContent ?? "Hello world\n\nSecond paragraph";
  await writeFile(paths.transcription(notebookId, pageId), content, "utf-8");

  return { notebookId, pageId };
}

describe("syncPage", () => {
  it("throws SYNC_DISABLED when sync is not enabled", async () => {
    const { pageId } = await setupNotebookAndPage();

    await expect(syncPage(pageId)).rejects.toThrow(SyncError);
    try {
      await syncPage(pageId);
    } catch (err) {
      expect((err as SyncError).code).toBe("SYNC_DISABLED");
    }
  });

  it("throws NO_DESTINATION when destination is empty", async () => {
    const { pageId } = await setupNotebookAndPage();
    await updateMarkdownConfig({
      sync: { enabled: true, destination: "" },
    });

    try {
      await syncPage(pageId);
    } catch (err) {
      expect((err as SyncError).code).toBe("NO_DESTINATION");
    }
  });

  it("throws PAGE_NOT_FOUND for non-existent page", async () => {
    await updateMarkdownConfig({
      sync: { enabled: true, destination: syncDir },
    });

    try {
      await syncPage("pg_nonexistent");
    } catch (err) {
      expect((err as SyncError).code).toBe("PAGE_NOT_FOUND");
    }
  });

  it("throws NO_TRANSCRIPTION for page without transcription", async () => {
    const notebookId = "nb_notrans";
    const pageId = "pg_notrans";
    const now = new Date().toISOString();

    await createNotebook({
      id: notebookId,
      title: "No Trans",
      createdAt: now,
      updatedAt: now,
    });

    await createPage({
      id: pageId,
      notebookId,
      pageNumber: 1,
      canvasX: 0,
      canvasY: 0,
      createdAt: now,
      updatedAt: now,
      transcription: { status: "none", lastAttempt: null, error: null },
    });

    await updateMarkdownConfig({
      sync: { enabled: true, destination: syncDir },
    });

    try {
      await syncPage(pageId);
    } catch (err) {
      expect((err as SyncError).code).toBe("NO_TRANSCRIPTION");
    }
  });

  it("syncs page to destination with correct filename", async () => {
    const { pageId } = await setupNotebookAndPage();

    await updateMarkdownConfig({
      frontmatter: { enabled: false },
      sync: {
        enabled: true,
        destination: syncDir,
        filenameTemplate: "{{notebook.name}}/{{page.seq}}-{{page.id}}.md",
      },
    });

    const result = await syncPage(pageId);
    expect(result.synced).toBe(true);
    expect(result.destination).toBe(
      join(syncDir, "Test Notebook", "1-pg_test1.md"),
    );

    const content = await readFile(result.destination, "utf-8");
    expect(content).toBe("Hello world\n\nSecond paragraph");
  });

  it("syncs page with frontmatter when enabled", async () => {
    const { pageId } = await setupNotebookAndPage({
      tags: ["meeting", "important"],
      transcriptionContent: "Meeting notes\n\nAction items here",
    });

    await updateMarkdownConfig({
      frontmatter: {
        enabled: true,
        template: {
          title: "{{transcription.firstLine}}",
          tags: "{{page.tags}}",
        },
      },
      sync: {
        enabled: true,
        destination: syncDir,
        filenameTemplate: "{{page.id}}.md",
      },
    });

    const result = await syncPage(pageId);
    const content = await readFile(result.destination, "utf-8");

    expect(content).toContain("---");
    // "Meeting notes" doesn't contain YAML special chars, so unquoted
    expect(content).toContain("title: Meeting notes");
    expect(content).toContain("  - meeting");
    expect(content).toContain("  - important");
    expect(content).toContain("Meeting notes\n\nAction items here");
  });

  it("creates nested directories from filename template", async () => {
    const { pageId } = await setupNotebookAndPage();

    await updateMarkdownConfig({
      frontmatter: { enabled: false },
      sync: {
        enabled: true,
        destination: syncDir,
        filenameTemplate: "{{notebook.name}}/subdir/{{page.id}}.md",
      },
    });

    const result = await syncPage(pageId);
    expect(existsSync(result.destination)).toBe(true);
  });
});

describe("syncNotebook", () => {
  it("syncs all transcribed pages", async () => {
    const notebookId = "nb_bulk";
    const now = new Date().toISOString();

    await createNotebook({
      id: notebookId,
      title: "Bulk Notebook",
      createdAt: now,
      updatedAt: now,
    });

    // Create 3 pages: 2 complete, 1 not
    for (let i = 1; i <= 3; i++) {
      const pageId = `pg_bulk${i}`;
      await createPage({
        id: pageId,
        notebookId,
        pageNumber: i,
        canvasX: 0,
        canvasY: 0,
        createdAt: now,
        updatedAt: now,
        transcription: {
          status: i <= 2 ? "complete" : "none",
          lastAttempt: i <= 2 ? now : null,
          error: null,
        },
      });
      if (i <= 2) {
        await writeFile(
          paths.transcription(notebookId, pageId),
          `Content of page ${i}`,
          "utf-8",
        );
      }
    }

    await updateMarkdownConfig({
      frontmatter: { enabled: false },
      sync: {
        enabled: true,
        destination: syncDir,
        filenameTemplate: "{{notebook.name}}/{{page.seq}}-{{page.id}}.md",
      },
    });

    const result = await syncNotebook(notebookId);
    expect(result.synced).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.destination).toBe(syncDir);

    // Verify files exist
    const file1 = await readFile(
      join(syncDir, "Bulk Notebook", "1-pg_bulk1.md"),
      "utf-8",
    );
    expect(file1).toBe("Content of page 1");

    const file2 = await readFile(
      join(syncDir, "Bulk Notebook", "2-pg_bulk2.md"),
      "utf-8",
    );
    expect(file2).toBe("Content of page 2");
  });

  it("throws NOTEBOOK_NOT_FOUND for non-existent notebook", async () => {
    await updateMarkdownConfig({
      sync: { enabled: true, destination: syncDir },
    });

    try {
      await syncNotebook("nb_missing");
    } catch (err) {
      expect((err as SyncError).code).toBe("NOTEBOOK_NOT_FOUND");
    }
  });
});

describe("regenerateFrontmatter", () => {
  it("updates frontmatter in existing transcription file", async () => {
    const { notebookId, pageId } = await setupNotebookAndPage({
      tags: ["old-tag"],
      transcriptionContent: "Some content here",
    });

    // Enable frontmatter
    await updateMarkdownConfig({
      frontmatter: {
        enabled: true,
        template: {
          tags: "{{page.tags}}",
          page_id: "{{page.id}}",
        },
      },
    });

    // First write with frontmatter (simulating initial save)
    await regenerateFrontmatter(pageId);

    const content1 = await readFile(
      paths.transcription(notebookId, pageId),
      "utf-8",
    );
    expect(content1).toContain("  - old-tag");

    // Now update tags
    await updatePage(pageId, { tags: ["new-tag", "another"] });

    // Regenerate
    await regenerateFrontmatter(pageId);

    const content2 = await readFile(
      paths.transcription(notebookId, pageId),
      "utf-8",
    );
    expect(content2).toContain("  - new-tag");
    expect(content2).toContain("  - another");
    expect(content2).not.toContain("old-tag");
    // Body should be preserved
    expect(content2).toContain("Some content here");
  });

  it("does nothing when frontmatter is disabled", async () => {
    const { notebookId, pageId } = await setupNotebookAndPage({
      transcriptionContent: "Original content",
    });

    await updateMarkdownConfig({ frontmatter: { enabled: false } });
    await regenerateFrontmatter(pageId);

    const content = await readFile(
      paths.transcription(notebookId, pageId),
      "utf-8",
    );
    expect(content).toBe("Original content");
  });

  it("handles page with no transcription file", async () => {
    // Create page but no transcription file
    const notebookId = "nb_nof";
    const pageId = "pg_nof";
    const now = new Date().toISOString();

    await createNotebook({
      id: notebookId,
      title: "No File",
      createdAt: now,
      updatedAt: now,
    });
    await createPage({
      id: pageId,
      notebookId,
      pageNumber: 1,
      canvasX: 0,
      canvasY: 0,
      createdAt: now,
      updatedAt: now,
    });

    await updateMarkdownConfig({
      frontmatter: { enabled: true, template: { title: "test" } },
    });

    // Should not throw
    await regenerateFrontmatter(pageId);
  });
});

describe("frontmatter duplication", () => {
  it("regenerateFrontmatter called twice does not duplicate frontmatter", async () => {
    const { notebookId, pageId } = await setupNotebookAndPage({
      tags: ["alpha"],
      transcriptionContent: "First line of content\n\nMore text",
    });

    await updateMarkdownConfig({
      frontmatter: {
        enabled: true,
        template: {
          title: "{{transcription.firstLine}}",
          tags: "{{page.tags}}",
        },
      },
    });

    // Call regenerate twice
    await regenerateFrontmatter(pageId);
    await regenerateFrontmatter(pageId);

    const content = await readFile(
      paths.transcription(notebookId, pageId),
      "utf-8",
    );

    // Count frontmatter delimiters — should be exactly 2
    const delimiterCount = content
      .split("\n")
      .filter((line) => line.trim() === "---").length;
    expect(delimiterCount).toBe(2);

    // Body (after frontmatter) must contain the content exactly once
    const body = stripFrontmatter(content);
    const bodyOccurrences = body.split("First line of content").length - 1;
    expect(bodyOccurrences).toBe(1);
  });

  it("syncPage does not duplicate frontmatter after regenerateFrontmatter", async () => {
    const { notebookId, pageId } = await setupNotebookAndPage({
      tags: ["sync-test"],
      transcriptionContent: "Sync content here\n\nParagraph two",
    });

    await updateMarkdownConfig({
      frontmatter: {
        enabled: true,
        template: {
          title: "{{transcription.firstLine}}",
          tags: "{{page.tags}}",
        },
      },
      sync: {
        enabled: true,
        destination: syncDir,
        filenameTemplate: "{{page.id}}.md",
      },
    });

    // First regenerate frontmatter (writes frontmatter into transcription file)
    await regenerateFrontmatter(pageId);

    // Then sync — should NOT produce double frontmatter
    const result = await syncPage(pageId);
    const synced = await readFile(result.destination, "utf-8");

    const delimiterCount = synced
      .split("\n")
      .filter((line) => line.trim() === "---").length;
    expect(delimiterCount).toBe(2);

    // Body (after frontmatter) should contain the content exactly once
    const body = stripFrontmatter(synced);
    const bodyOccurrences = body.split("Sync content here").length - 1;
    expect(bodyOccurrences).toBe(1);
  });

  it("syncPage produces consistent output on repeated calls", async () => {
    const { pageId } = await setupNotebookAndPage({
      transcriptionContent: "Repeatable content\n\nBody",
    });

    await updateMarkdownConfig({
      frontmatter: {
        enabled: true,
        template: { title: "{{transcription.firstLine}}" },
      },
      sync: {
        enabled: true,
        destination: syncDir,
        filenameTemplate: "{{page.id}}.md",
      },
    });

    const result1 = await syncPage(pageId);
    const content1 = await readFile(result1.destination, "utf-8");

    // Sync again — the transcription file itself hasn't changed,
    // but if generatePageMarkdown doesn't strip, regenerateFrontmatter
    // could have made the source file carry frontmatter
    await regenerateFrontmatter(pageId);
    const result2 = await syncPage(pageId);
    const content2 = await readFile(result2.destination, "utf-8");

    // Both outputs should have exactly one frontmatter block
    for (const content of [content1, content2]) {
      const delimiterCount = content
        .split("\n")
        .filter((line) => line.trim() === "---").length;
      expect(delimiterCount).toBe(2);
    }
  });

  it("syncNotebook does not duplicate frontmatter after regeneration", async () => {
    const { notebookId, pageId } = await setupNotebookAndPage({
      tags: ["bulk"],
      transcriptionContent: "Notebook page content\n\nDetails",
    });

    await updateMarkdownConfig({
      frontmatter: {
        enabled: true,
        template: {
          title: "{{transcription.firstLine}}",
          tags: "{{page.tags}}",
        },
      },
      sync: {
        enabled: true,
        destination: syncDir,
        filenameTemplate: "{{notebook.name}}/{{page.id}}.md",
      },
    });

    // Regenerate frontmatter first
    await regenerateFrontmatter(pageId);

    // Then bulk sync
    const result = await syncNotebook(notebookId);
    expect(result.synced).toBe(1);

    const synced = await readFile(
      join(syncDir, "Test Notebook", "pg_test1.md"),
      "utf-8",
    );

    const delimiterCount = synced
      .split("\n")
      .filter((line) => line.trim() === "---").length;
    expect(delimiterCount).toBe(2);

    const body = stripFrontmatter(synced);
    expect(body.split("Notebook page content").length - 1).toBe(1);
  });
});

describe("stripFrontmatter", () => {
  it("strips YAML frontmatter from content", () => {
    const input = "---\ntitle: Test\ntags:\n  - a\n---\nBody content here";
    expect(stripFrontmatter(input)).toBe("Body content here");
  });

  it("returns content unchanged if no frontmatter", () => {
    expect(stripFrontmatter("Just content")).toBe("Just content");
  });

  it("handles frontmatter with no body", () => {
    const input = "---\ntitle: Test\n---";
    expect(stripFrontmatter(input)).toBe("");
  });

  it("handles empty string", () => {
    expect(stripFrontmatter("")).toBe("");
  });

  it("handles content starting with --- but not valid frontmatter", () => {
    const input = "--- some text\nnot frontmatter";
    expect(stripFrontmatter(input)).toBe("--- some text\nnot frontmatter");
  });
});

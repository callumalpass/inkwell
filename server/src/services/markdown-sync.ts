import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { existsSync } from "node:fs";
import type { PageMeta, NotebookMeta, MarkdownConfig } from "../types/index.js";
import { getPage, listPages } from "../storage/page-store.js";
import { getNotebook } from "../storage/notebook-store.js";
import { getMarkdownConfig, recordSync } from "../storage/config-store.js";
import { paths } from "../storage/paths.js";
import {
  buildMarkdownWithFrontmatter,
  resolveFilenameTemplate,
  stripFrontmatter,
  type TemplateContext,
} from "./frontmatter.js";
import { exportPagePdf } from "./export.js";

/**
 * Build a TemplateContext from a page ID by loading all required data.
 */
async function buildContext(
  page: PageMeta,
  notebook: NotebookMeta,
): Promise<TemplateContext> {
  let transcriptionContent: string | null = null;
  try {
    const raw = await readFile(
      paths.transcription(notebook.id, page.id),
      "utf-8",
    );
    // Strip any existing frontmatter so template variables resolve against the body
    transcriptionContent = stripFrontmatter(raw);
  } catch (err) {
    if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) throw err;
  }

  return {
    page,
    notebook,
    transcriptionContent,
  };
}

/**
 * Generate the full markdown content for a page (with frontmatter if configured).
 */
async function generatePageMarkdown(
  page: PageMeta,
  notebook: NotebookMeta,
  mdConfig: MarkdownConfig,
): Promise<string> {
  const context = await buildContext(page, notebook);
  const rawContent = context.transcriptionContent ?? "";
  return buildMarkdownWithFrontmatter(mdConfig, context, rawContent);
}

/**
 * Compute the destination file path for a synced page.
 */
function computeDestPath(
  page: PageMeta,
  notebook: NotebookMeta,
  mdConfig: MarkdownConfig,
  transcriptionContent: string | null,
): string {
  const context: TemplateContext = { page, notebook, transcriptionContent };
  const relativePath = resolveFilenameTemplate(
    mdConfig.sync.filenameTemplate,
    context,
  );
  return join(mdConfig.sync.destination, relativePath);
}

function toPdfPath(markdownPath: string): string {
  const ext = extname(markdownPath);
  if (ext) return markdownPath.slice(0, -ext.length) + ".pdf";
  return markdownPath + ".pdf";
}

export interface SyncPageResult {
  synced: boolean;
  destination: string;
}

/**
 * Sync a single page's markdown to the configured destination.
 * Returns the destination path and whether the sync was successful.
 */
export async function syncPage(pageId: string): Promise<SyncPageResult> {
  const mdConfig = await getMarkdownConfig();

  if (!mdConfig.sync.enabled) {
    throw new SyncError("SYNC_DISABLED", "Markdown sync is not enabled");
  }

  if (!mdConfig.sync.destination) {
    throw new SyncError("NO_DESTINATION", "No sync destination configured");
  }

  const page = await getPage(pageId);
  if (!page) {
    throw new SyncError("PAGE_NOT_FOUND", `Page ${pageId} not found`);
  }

  if (
    page.transcription?.status !== "complete"
  ) {
    throw new SyncError(
      "NO_TRANSCRIPTION",
      `Page ${pageId} has no completed transcription`,
    );
  }

  const notebook = await getNotebook(page.notebookId);
  if (!notebook) {
    throw new SyncError(
      "NOTEBOOK_NOT_FOUND",
      `Notebook ${page.notebookId} not found`,
    );
  }

  const content = await generatePageMarkdown(page, notebook, mdConfig);

  let transcriptionContent: string | null = null;
  try {
    transcriptionContent = await readFile(
      paths.transcription(notebook.id, page.id),
      "utf-8",
    );
  } catch {
    // No transcription content
  }

  const destPath = computeDestPath(page, notebook, mdConfig, transcriptionContent);

  // Ensure the destination directory exists
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, content, "utf-8");

  const pdfBuffer = await exportPagePdf(pageId, {
    includeTranscription: true,
    pageSize: "original",
  });
  if (pdfBuffer) {
    await writeFile(toPdfPath(destPath), pdfBuffer);
  }

  await recordSync(1);

  return { synced: true, destination: destPath };
}

export interface SyncNotebookResult {
  synced: number;
  skipped: number;
  destination: string;
}

/**
 * Sync all transcribed pages in a notebook to the configured destination.
 */
export async function syncNotebook(
  notebookId: string,
): Promise<SyncNotebookResult> {
  const mdConfig = await getMarkdownConfig();

  if (!mdConfig.sync.enabled) {
    throw new SyncError("SYNC_DISABLED", "Markdown sync is not enabled");
  }

  if (!mdConfig.sync.destination) {
    throw new SyncError("NO_DESTINATION", "No sync destination configured");
  }

  const notebook = await getNotebook(notebookId);
  if (!notebook) {
    throw new SyncError("NOTEBOOK_NOT_FOUND", `Notebook ${notebookId} not found`);
  }

  const pages = await listPages(notebookId);
  let synced = 0;
  let skipped = 0;

  for (const page of pages) {
    if (page.transcription?.status !== "complete") {
      skipped++;
      continue;
    }

    const content = await generatePageMarkdown(page, notebook, mdConfig);

    let transcriptionContent: string | null = null;
    try {
      transcriptionContent = await readFile(
        paths.transcription(notebook.id, page.id),
        "utf-8",
      );
    } catch {
      // No transcription content
    }

    const destPath = computeDestPath(page, notebook, mdConfig, transcriptionContent);

    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, content, "utf-8");

    const pdfBuffer = await exportPagePdf(page.id, {
      includeTranscription: true,
      pageSize: "original",
    });
    if (pdfBuffer) {
      await writeFile(toPdfPath(destPath), pdfBuffer);
    }
    synced++;
  }

  if (synced > 0) {
    await recordSync(synced);
  }

  return {
    synced,
    skipped,
    destination: mdConfig.sync.destination,
  };
}

/**
 * Regenerate the transcription.md file for a page with current frontmatter.
 * Called when page metadata changes (tags, etc.) and frontmatter needs updating.
 */
export async function regenerateFrontmatter(pageId: string): Promise<void> {
  const mdConfig = await getMarkdownConfig();
  if (!mdConfig.frontmatter.enabled) return;

  const page = await getPage(pageId);
  if (!page) return;

  const notebook = await getNotebook(page.notebookId);
  if (!notebook) return;

  // Read the current transcription content (stripping existing frontmatter)
  const filePath = paths.transcription(notebook.id, page.id);
  let rawContent: string;
  try {
    const fileContent = await readFile(filePath, "utf-8");
    rawContent = stripFrontmatter(fileContent);
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return; // No transcription file yet
    throw err;
  }

  const context: TemplateContext = {
    page,
    notebook,
    transcriptionContent: rawContent,
  };

  const newContent = buildMarkdownWithFrontmatter(mdConfig, context, rawContent);
  await writeFile(filePath, newContent, "utf-8");
}

// Re-export stripFrontmatter so existing imports from this module continue to work.
export { stripFrontmatter } from "./frontmatter.js";

export class SyncError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SyncError";
  }
}

import { join } from "node:path";
import { config } from "../config.js";

export const paths = {
  data: () => config.dataDir,
  notebooks: () => join(config.dataDir, "notebooks"),
  notebook: (id: string) => join(config.dataDir, "notebooks", id),
  notebookMeta: (id: string) => join(config.dataDir, "notebooks", id, "meta.json"),
  pages: (notebookId: string) => join(config.dataDir, "notebooks", notebookId, "pages"),
  page: (notebookId: string, pageId: string) =>
    join(config.dataDir, "notebooks", notebookId, "pages", pageId),
  pageMeta: (notebookId: string, pageId: string) =>
    join(config.dataDir, "notebooks", notebookId, "pages", pageId, "meta.json"),
  strokes: (notebookId: string, pageId: string) =>
    join(config.dataDir, "notebooks", notebookId, "pages", pageId, "strokes.json"),
  thumbnail: (notebookId: string, pageId: string) =>
    join(config.dataDir, "notebooks", notebookId, "pages", pageId, "thumbnail.png"),
  transcription: (notebookId: string, pageId: string) =>
    join(config.dataDir, "notebooks", notebookId, "pages", pageId, "transcription.md"),
  pageIndex: () => join(config.dataDir, "page-index.json"),
  // Transcription queue directories
  queueDir: () => join(config.dataDir, "queue"),
  queuePending: () => join(config.dataDir, "queue", "pending"),
  queueFailed: () => join(config.dataDir, "queue", "failed"),
  queueJob: (dir: "pending" | "failed", jobId: string) =>
    join(config.dataDir, "queue", dir, `${jobId}.json`),
};

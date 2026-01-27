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
  pageIndex: () => join(config.dataDir, "page-index.json"),
};

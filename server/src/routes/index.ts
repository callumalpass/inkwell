import type { FastifyInstance } from "fastify";
import { notebookRoutes } from "./notebooks.js";
import { pageRoutes } from "./pages.js";
import { strokeRoutes } from "./strokes.js";
import { thumbnailRoutes } from "./thumbnails.js";
import { transcriptionRoutes } from "./transcription.js";
import { exportRoutes } from "./export.js";
import { searchRoutes } from "./search.js";
import { markdownSyncRoutes } from "./markdown-sync.js";
import { settingsRoutes } from "./settings.js";

export function registerRoutes(app: FastifyInstance) {
  notebookRoutes(app);
  pageRoutes(app);
  strokeRoutes(app);
  thumbnailRoutes(app);
  transcriptionRoutes(app);
  exportRoutes(app);
  searchRoutes(app);
  markdownSyncRoutes(app);
  settingsRoutes(app);
}

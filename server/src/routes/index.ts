import type { FastifyInstance } from "fastify";
import { notebookRoutes } from "./notebooks.js";
import { pageRoutes } from "./pages.js";
import { strokeRoutes } from "./strokes.js";
import { thumbnailRoutes } from "./thumbnails.js";

export function registerRoutes(app: FastifyInstance) {
  notebookRoutes(app);
  pageRoutes(app);
  strokeRoutes(app);
  thumbnailRoutes(app);
}

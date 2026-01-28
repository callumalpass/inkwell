import type { FastifyInstance } from "fastify";
import type { AppSettings } from "../types/index.js";
import { getAppSettings, updateAppSettings } from "../storage/config-store.js";

export function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings", async () => {
    return getAppSettings();
  });

  app.put<{ Body: Partial<AppSettings> }>(
    "/api/settings",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            defaultPenStyle: {
              type: "string",
              enum: ["pressure", "uniform", "ballpoint"],
            },
            defaultColor: {
              type: "string",
              pattern: "^#[0-9a-fA-F]{6}$",
            },
            defaultStrokeWidth: {
              type: "number",
              enum: [2, 3, 5, 8],
            },
            defaultGridType: {
              type: "string",
              enum: ["none", "lined", "grid", "dotgrid"],
            },
            defaultViewMode: {
              type: "string",
              enum: ["single", "scroll", "canvas"],
            },
            autoTranscribe: {
              type: "boolean",
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req) => {
      return updateAppSettings(req.body);
    },
  );
}

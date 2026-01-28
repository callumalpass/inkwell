import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import type { AppSettings } from "../types/index.js";

let app: FastifyInstance;
let originalDataDir: string;
let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-settings-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

describe("GET /api/settings", () => {
  it("returns empty defaults initially", async () => {
    const res = await app.inject({ method: "GET", url: "/api/settings" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
  });

  it("returns previously saved settings", async () => {
    await app.inject({
      method: "PUT",
      url: "/api/settings",
      payload: { defaultPenStyle: "ballpoint" },
    });

    const res = await app.inject({ method: "GET", url: "/api/settings" });
    expect(res.statusCode).toBe(200);
    expect(res.json().defaultPenStyle).toBe("ballpoint");
  });
});

describe("PUT /api/settings", () => {
  describe("happy path", () => {
    it("updates a single setting and returns the full settings", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultPenStyle: "uniform" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().defaultPenStyle).toBe("uniform");
    });

    it("updates multiple settings at once", async () => {
      const payload: Partial<AppSettings> = {
        defaultPenStyle: "pressure",
        defaultColor: "#ff0000",
        defaultStrokeWidth: 5,
        defaultGridType: "lined",
        defaultViewMode: "scroll",
        autoTranscribe: true,
      };

      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.defaultPenStyle).toBe("pressure");
      expect(body.defaultColor).toBe("#ff0000");
      expect(body.defaultStrokeWidth).toBe(5);
      expect(body.defaultGridType).toBe("lined");
      expect(body.defaultViewMode).toBe("scroll");
      expect(body.autoTranscribe).toBe(true);
    });

    it("persists settings across requests", async () => {
      await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultGridType: "dotgrid", autoTranscribe: false },
      });

      const res = await app.inject({ method: "GET", url: "/api/settings" });
      expect(res.statusCode).toBe(200);
      expect(res.json().defaultGridType).toBe("dotgrid");
      expect(res.json().autoTranscribe).toBe(false);
    });

    it("merges with existing settings on subsequent updates", async () => {
      await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultPenStyle: "ballpoint", defaultColor: "#000000" },
      });

      await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultColor: "#ffffff", defaultStrokeWidth: 8 },
      });

      const res = await app.inject({ method: "GET", url: "/api/settings" });
      const body = res.json();
      expect(body.defaultPenStyle).toBe("ballpoint");
      expect(body.defaultColor).toBe("#ffffff");
      expect(body.defaultStrokeWidth).toBe(8);
    });

    it("accepts an empty body (no-op update)", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: {},
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("defaultPenStyle validation", () => {
    it.each(["pressure", "uniform", "ballpoint"])(
      "accepts valid pen style: %s",
      async (style) => {
        const res = await app.inject({
          method: "PUT",
          url: "/api/settings",
          payload: { defaultPenStyle: style },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().defaultPenStyle).toBe(style);
      },
    );

    it("rejects invalid pen style", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultPenStyle: "crayon" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("defaultColor validation", () => {
    it.each(["#000000", "#ffffff", "#1e40af", "#AABBCC", "#123abc"])(
      "accepts valid hex color: %s",
      async (color) => {
        const res = await app.inject({
          method: "PUT",
          url: "/api/settings",
          payload: { defaultColor: color },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().defaultColor).toBe(color);
      },
    );

    it("rejects color without hash prefix", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultColor: "ff0000" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects shorthand hex color", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultColor: "#f00" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects named color", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultColor: "red" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects hex color with alpha channel", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultColor: "#ff000080" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects empty string", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultColor: "" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("defaultStrokeWidth validation", () => {
    it.each([2, 3, 5, 8])(
      "accepts valid stroke width: %d",
      async (width) => {
        const res = await app.inject({
          method: "PUT",
          url: "/api/settings",
          payload: { defaultStrokeWidth: width },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().defaultStrokeWidth).toBe(width);
      },
    );

    it("rejects stroke width not in allowed list", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultStrokeWidth: 4 },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects zero width", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultStrokeWidth: 0 },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects negative width", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultStrokeWidth: -1 },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects floating point width", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultStrokeWidth: 2.5 },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("defaultGridType validation", () => {
    it.each(["none", "lined", "grid", "dotgrid"])(
      "accepts valid grid type: %s",
      async (gridType) => {
        const res = await app.inject({
          method: "PUT",
          url: "/api/settings",
          payload: { defaultGridType: gridType },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().defaultGridType).toBe(gridType);
      },
    );

    it("rejects invalid grid type", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultGridType: "hexagonal" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("defaultViewMode validation", () => {
    it.each(["single", "canvas", "overview"])(
      "accepts valid view mode: %s",
      async (viewMode) => {
        const res = await app.inject({
          method: "PUT",
          url: "/api/settings",
          payload: { defaultViewMode: viewMode },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().defaultViewMode).toBe(viewMode);
      },
    );

    it("rejects invalid view mode", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultViewMode: "split" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("autoTranscribe validation", () => {
    it("accepts true", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { autoTranscribe: true },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().autoTranscribe).toBe(true);
    });

    it("accepts false", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { autoTranscribe: false },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().autoTranscribe).toBe(false);
    });

    it("rejects non-boolean autoTranscribe", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { autoTranscribe: "yes" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("unknown properties stripped", () => {
    it("strips unknown properties silently", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { theme: "dark" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).not.toHaveProperty("theme");
    });

    it("strips extra properties but keeps valid ones", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { defaultPenStyle: "pressure", unknown: 42 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().defaultPenStyle).toBe("pressure");
      expect(res.json()).not.toHaveProperty("unknown");
    });
  });
});

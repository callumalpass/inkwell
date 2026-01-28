import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getStrokes, postStrokes, deleteStroke, clearStrokes, type Stroke } from "./strokes";
import { ApiError } from "./client";

describe("strokes API", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  const mockStroke: Stroke = {
    id: "stroke_123",
    points: [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 10, y: 10, pressure: 0.7 },
      { x: 20, y: 15, pressure: 0.6 },
    ],
    color: "#000000",
    width: 2,
    createdAt: "2024-01-01T00:00:00Z",
  };

  describe("getStrokes", () => {
    it("should fetch all strokes for a page", async () => {
      const strokes: Stroke[] = [
        mockStroke,
        { ...mockStroke, id: "stroke_456" },
        { ...mockStroke, id: "stroke_789" },
      ];

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(strokes),
      });

      const result = await getStrokes("pg_123");

      expect(result).toEqual(strokes);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123/strokes",
        expect.objectContaining({
          headers: expect.any(Object),
        }),
      );
    });

    it("should return empty array when page has no strokes", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      const result = await getStrokes("pg_empty");
      expect(result).toEqual([]);
    });

    it("should throw ApiError for non-existent page", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Page not found" })),
      });

      const error = await getStrokes("pg_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
      expect(error.message).toBe("Page not found");
    });

    it("should throw ApiError on server error after retries exhausted", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ error: "Database error" })),
      });

      let caughtError: unknown;
      const promise = getStrokes("pg_123").catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(caughtError).toBeInstanceOf(ApiError);
      expect((caughtError as ApiError).status).toBe(500);
    });

    it("should handle strokes with pen styles", async () => {
      const strokeWithStyle: Stroke = {
        ...mockStroke,
        penStyle: "pressure",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([strokeWithStyle]),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].penStyle).toBe("pressure");
    });

    it("should handle strokes with tool type", async () => {
      const strokeWithTool: Stroke = {
        ...mockStroke,
        tool: "highlighter",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([strokeWithTool]),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].tool).toBe("highlighter");
    });
  });

  describe("postStrokes", () => {
    it("should post a single stroke to a page", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 1 }),
      });

      const result = await postStrokes("pg_123", [mockStroke]);

      expect(result).toEqual({ count: 1 });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123/strokes",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ strokes: [mockStroke] }),
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should post multiple strokes to a page", async () => {
      const strokes: Stroke[] = [
        mockStroke,
        { ...mockStroke, id: "stroke_456" },
        { ...mockStroke, id: "stroke_789" },
      ];

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 3 }),
      });

      const result = await postStrokes("pg_123", strokes);

      expect(result).toEqual({ count: 3 });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123/strokes",
        expect.objectContaining({
          body: JSON.stringify({ strokes }),
        }),
      );
    });

    it("should handle empty strokes array", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 0 }),
      });

      const result = await postStrokes("pg_123", []);

      expect(result).toEqual({ count: 0 });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123/strokes",
        expect.objectContaining({
          body: JSON.stringify({ strokes: [] }),
        }),
      );
    });

    it("should throw ApiError for non-existent page", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Page not found" })),
      });

      const error = await postStrokes("pg_nonexistent", [mockStroke]).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should throw ApiError on validation error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve(JSON.stringify({ error: "Invalid stroke data" })),
      });

      const error = await postStrokes("pg_123", [mockStroke]).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(400);
      expect(error.message).toBe("Invalid stroke data");
    });

    it("should handle strokes with different pen styles", async () => {
      const strokes: Stroke[] = [
        { ...mockStroke, id: "stroke_1", penStyle: "pressure" },
        { ...mockStroke, id: "stroke_2", penStyle: "uniform" },
        { ...mockStroke, id: "stroke_3", penStyle: "tapered" },
      ];

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 3 }),
      });

      const result = await postStrokes("pg_123", strokes);
      expect(result.count).toBe(3);
    });

    it("should handle strokes with highlighter tool", async () => {
      const highlighterStroke: Stroke = {
        ...mockStroke,
        tool: "highlighter",
        color: "#FFFF0080",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 1 }),
      });

      await postStrokes("pg_123", [highlighterStroke]);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123/strokes",
        expect.objectContaining({
          body: JSON.stringify({ strokes: [highlighterStroke] }),
        }),
      );
    });
  });

  describe("deleteStroke", () => {
    it("should delete a single stroke from a page", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 1 }),
      });

      const result = await deleteStroke("pg_123", "stroke_123");

      expect(result).toEqual({ count: 1 });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123/strokes/stroke_123",
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should throw ApiError for non-existent stroke", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Stroke not found" })),
      });

      const error = await deleteStroke("pg_123", "stroke_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
      expect(error.message).toBe("Stroke not found");
    });

    it("should throw ApiError for non-existent page", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Page not found" })),
      });

      const error = await deleteStroke("pg_nonexistent", "stroke_123").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should handle server errors during deletion after retries exhausted", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ error: "Failed to delete stroke" })),
      });

      let caughtError: unknown;
      const promise = deleteStroke("pg_123", "stroke_123").catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(caughtError).toBeInstanceOf(ApiError);
      expect((caughtError as ApiError).status).toBe(500);
    });
  });

  describe("clearStrokes", () => {
    it("should clear all strokes from a page", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await clearStrokes("pg_123");

      expect(result).toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123/strokes",
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should throw ApiError for non-existent page", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Page not found" })),
      });

      const error = await clearStrokes("pg_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should succeed even when page has no strokes", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await clearStrokes("pg_empty");
      expect(result).toBeUndefined();
    });

    it("should handle server errors after retries exhausted", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ error: "Failed to clear strokes" })),
      });

      let caughtError: unknown;
      const promise = clearStrokes("pg_123").catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(caughtError).toBeInstanceOf(ApiError);
      expect((caughtError as ApiError).status).toBe(500);
    });
  });

  describe("retry behavior", () => {
    it("should retry on transient server errors", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: () => Promise.resolve("Temporarily down"),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve([mockStroke]),
        });

      globalThis.fetch = fetchMock;

      const promise = getStrokes("pg_123");
      await vi.advanceTimersByTimeAsync(1500);

      const result = await promise;
      expect(result).toEqual([mockStroke]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should not retry on client errors", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Invalid request"),
      });

      globalThis.fetch = fetchMock;

      await expect(postStrokes("pg_123", [mockStroke])).rejects.toThrow(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should retry on network errors", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve([mockStroke]),
        });

      globalThis.fetch = fetchMock;

      const promise = getStrokes("pg_123");
      await vi.advanceTimersByTimeAsync(1500);

      const result = await promise;
      expect(result).toEqual([mockStroke]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("should handle strokes with many points", async () => {
      const manyPoints = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: i * 0.5,
        pressure: 0.5 + (i % 10) * 0.05,
      }));

      const strokeWithManyPoints: Stroke = {
        ...mockStroke,
        points: manyPoints,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([strokeWithManyPoints]),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].points).toHaveLength(1000);
    });

    it("should handle strokes with single point", async () => {
      const singlePointStroke: Stroke = {
        ...mockStroke,
        points: [{ x: 100, y: 100, pressure: 0.5 }],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([singlePointStroke]),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].points).toHaveLength(1);
    });

    it("should handle strokes with negative coordinates", async () => {
      const negativeCoordStroke: Stroke = {
        ...mockStroke,
        points: [
          { x: -100, y: -200, pressure: 0.5 },
          { x: -50, y: -100, pressure: 0.6 },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([negativeCoordStroke]),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].points[0].x).toBe(-100);
      expect(result[0].points[0].y).toBe(-200);
    });

    it("should handle strokes with very large coordinates", async () => {
      const largeCoordStroke: Stroke = {
        ...mockStroke,
        points: [
          { x: 999999, y: 999999, pressure: 0.5 },
          { x: 1000000, y: 1000000, pressure: 0.6 },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([largeCoordStroke]),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].points[0].x).toBe(999999);
    });

    it("should handle strokes with decimal pressure values", async () => {
      const decimalPressureStroke: Stroke = {
        ...mockStroke,
        points: [
          { x: 0, y: 0, pressure: 0.001 },
          { x: 10, y: 10, pressure: 0.999 },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([decimalPressureStroke]),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].points[0].pressure).toBe(0.001);
      expect(result[0].points[1].pressure).toBe(0.999);
    });

    it("should handle strokes with zero pressure", async () => {
      const zeroPressureStroke: Stroke = {
        ...mockStroke,
        points: [
          { x: 0, y: 0, pressure: 0 },
          { x: 10, y: 10, pressure: 0 },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([zeroPressureStroke]),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].points[0].pressure).toBe(0);
    });

    it("should handle strokes with maximum pressure", async () => {
      const maxPressureStroke: Stroke = {
        ...mockStroke,
        points: [
          { x: 0, y: 0, pressure: 1 },
          { x: 10, y: 10, pressure: 1 },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([maxPressureStroke]),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].points[0].pressure).toBe(1);
    });

    it("should handle strokes with various color formats", async () => {
      const strokes: Stroke[] = [
        { ...mockStroke, id: "s1", color: "#FF0000" },
        { ...mockStroke, id: "s2", color: "#ff0000" },
        { ...mockStroke, id: "s3", color: "#FFFFFF80" },
        { ...mockStroke, id: "s4", color: "rgb(255, 0, 0)" },
      ];

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(strokes),
      });

      const result = await getStrokes("pg_123");
      expect(result).toHaveLength(4);
      expect(result[2].color).toBe("#FFFFFF80");
    });

    it("should handle strokes with various width values", async () => {
      const strokes: Stroke[] = [
        { ...mockStroke, id: "s1", width: 0.5 },
        { ...mockStroke, id: "s2", width: 1 },
        { ...mockStroke, id: "s3", width: 10 },
        { ...mockStroke, id: "s4", width: 50 },
      ];

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(strokes),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].width).toBe(0.5);
      expect(result[3].width).toBe(50);
    });

    it("should handle very long stroke id", async () => {
      const longId = "stroke_" + "a".repeat(100);
      const strokeWithLongId: Stroke = {
        ...mockStroke,
        id: longId,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([strokeWithLongId]),
      });

      const result = await getStrokes("pg_123");
      expect(result[0].id).toBe(longId);
    });

    it("should handle special characters in page id", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      await getStrokes("pg_123-456_test");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123-456_test/strokes",
        expect.any(Object),
      );
    });

    it("should handle page with many strokes", async () => {
      const manyStrokes = Array.from({ length: 500 }, (_, i) => ({
        ...mockStroke,
        id: `stroke_${i}`,
      }));

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(manyStrokes),
      });

      const result = await getStrokes("pg_123");
      expect(result).toHaveLength(500);
    });

    it("should handle posting strokes with empty points array", async () => {
      const emptyPointsStroke: Stroke = {
        ...mockStroke,
        points: [],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 1 }),
      });

      await postStrokes("pg_123", [emptyPointsStroke]);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123/strokes",
        expect.objectContaining({
          body: JSON.stringify({ strokes: [emptyPointsStroke] }),
        }),
      );
    });
  });
});

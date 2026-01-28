import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listNotebooks,
  getNotebook,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  duplicateNotebook,
  type NotebookMeta,
} from "./notebooks";
import { ApiError } from "./client";

describe("notebooks API", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  const mockNotebook: NotebookMeta = {
    id: "nb_123",
    title: "Test Notebook",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    pageCount: 5,
    coverPageId: "pg_cover",
    settings: {
      defaultTool: "pen",
      defaultColor: "#000000",
      defaultStrokeWidth: 2,
      gridType: "lined",
      backgroundLineSpacing: 40,
    },
  };

  describe("listNotebooks", () => {
    it("should fetch all notebooks", async () => {
      const notebooks: NotebookMeta[] = [
        mockNotebook,
        { ...mockNotebook, id: "nb_456", title: "Second Notebook" },
      ];

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(notebooks),
      });

      const result = await listNotebooks();

      expect(result).toEqual(notebooks);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks",
        expect.objectContaining({
          headers: expect.any(Object),
        }),
      );
    });

    it("should return empty array when no notebooks exist", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      const result = await listNotebooks();
      expect(result).toEqual([]);
    });

    it("should throw ApiError on server error after retries exhausted", async () => {
      // 500 errors are retried, so we need to exhaust retries
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ error: "Database error" })),
      });

      let caughtError: unknown;
      const promise = listNotebooks().catch((e) => {
        caughtError = e;
      });

      // Advance through all retries (default is 3 retries with exponential backoff)
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(caughtError).toBeInstanceOf(ApiError);
      expect((caughtError as ApiError).status).toBe(500);
    });
  });

  describe("getNotebook", () => {
    it("should fetch a single notebook by id", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockNotebook),
      });

      const result = await getNotebook("nb_123");

      expect(result).toEqual(mockNotebook);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks/nb_123",
        expect.objectContaining({
          headers: expect.any(Object),
        }),
      );
    });

    it("should throw ApiError for non-existent notebook", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Notebook not found" })),
      });

      const error = await getNotebook("nb_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
      expect(error.message).toBe("Notebook not found");
    });

    it("should handle notebooks with minimal data", async () => {
      const minimalNotebook: NotebookMeta = {
        id: "nb_minimal",
        title: "Minimal",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(minimalNotebook),
      });

      const result = await getNotebook("nb_minimal");

      expect(result).toEqual(minimalNotebook);
      expect(result.pageCount).toBeUndefined();
      expect(result.coverPageId).toBeUndefined();
      expect(result.settings).toBeUndefined();
    });

    it("should handle notebooks with null coverPageId", async () => {
      const notebookNoCover: NotebookMeta = {
        ...mockNotebook,
        coverPageId: null,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(notebookNoCover),
      });

      const result = await getNotebook("nb_123");
      expect(result.coverPageId).toBeNull();
    });
  });

  describe("createNotebook", () => {
    it("should create a new notebook with title", async () => {
      const newNotebook: NotebookMeta = {
        id: "nb_new",
        title: "New Notebook",
        createdAt: "2024-01-15T00:00:00Z",
        updatedAt: "2024-01-15T00:00:00Z",
        pageCount: 0,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(newNotebook),
      });

      const result = await createNotebook("New Notebook");

      expect(result).toEqual(newNotebook);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "New Notebook" }),
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should create notebook with empty title", async () => {
      const newNotebook: NotebookMeta = {
        id: "nb_empty",
        title: "",
        createdAt: "2024-01-15T00:00:00Z",
        updatedAt: "2024-01-15T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(newNotebook),
      });

      const result = await createNotebook("");
      expect(result.title).toBe("");
    });

    it("should create notebook with special characters in title", async () => {
      const specialTitle = "Test <script>alert('xss')</script> Notebook & More";
      const newNotebook: NotebookMeta = {
        id: "nb_special",
        title: specialTitle,
        createdAt: "2024-01-15T00:00:00Z",
        updatedAt: "2024-01-15T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(newNotebook),
      });

      const result = await createNotebook(specialTitle);

      expect(result.title).toBe(specialTitle);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks",
        expect.objectContaining({
          body: JSON.stringify({ title: specialTitle }),
        }),
      );
    });

    it("should handle validation errors", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve(JSON.stringify({ error: "Title too long" })),
      });

      const error = await createNotebook("x".repeat(1000)).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(400);
    });
  });

  describe("updateNotebook", () => {
    it("should update notebook title", async () => {
      const updatedNotebook: NotebookMeta = {
        ...mockNotebook,
        title: "Updated Title",
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedNotebook),
      });

      const result = await updateNotebook("nb_123", { title: "Updated Title" });

      expect(result.title).toBe("Updated Title");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks/nb_123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ title: "Updated Title" }),
        }),
      );
    });

    it("should update notebook settings", async () => {
      const newSettings = {
        defaultTool: "highlighter" as const,
        defaultColor: "#FFFF00",
        gridType: "dotgrid" as const,
      };

      const updatedNotebook: NotebookMeta = {
        ...mockNotebook,
        settings: { ...mockNotebook.settings, ...newSettings },
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedNotebook),
      });

      const result = await updateNotebook("nb_123", { settings: newSettings });

      expect(result.settings?.defaultTool).toBe("highlighter");
      expect(result.settings?.defaultColor).toBe("#FFFF00");
      expect(result.settings?.gridType).toBe("dotgrid");
    });

    it("should update both title and settings together", async () => {
      const updates = {
        title: "New Title",
        settings: {
          defaultTool: "eraser" as const,
          backgroundLineSpacing: 50,
        },
      };

      const updatedNotebook: NotebookMeta = {
        ...mockNotebook,
        ...updates,
        settings: { ...mockNotebook.settings, ...updates.settings },
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedNotebook),
      });

      const result = await updateNotebook("nb_123", updates);

      expect(result.title).toBe("New Title");
      expect(result.settings?.defaultTool).toBe("eraser");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks/nb_123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(updates),
        }),
      );
    });

    it("should handle empty updates", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockNotebook),
      });

      const result = await updateNotebook("nb_123", {});

      expect(result).toEqual(mockNotebook);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks/nb_123",
        expect.objectContaining({
          body: JSON.stringify({}),
        }),
      );
    });

    it("should throw ApiError for non-existent notebook", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Notebook not found" })),
      });

      const error = await updateNotebook("nb_nonexistent", { title: "Test" }).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should update settings with all grid types", async () => {
      const gridTypes = ["none", "lined", "grid", "dotgrid"] as const;

      for (const gridType of gridTypes) {
        const updatedNotebook: NotebookMeta = {
          ...mockNotebook,
          settings: { ...mockNotebook.settings, gridType },
        };

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(updatedNotebook),
        });

        const result = await updateNotebook("nb_123", { settings: { gridType } });
        expect(result.settings?.gridType).toBe(gridType);
      }
    });
  });

  describe("deleteNotebook", () => {
    it("should delete a notebook", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await deleteNotebook("nb_123");

      expect(result).toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks/nb_123",
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should throw ApiError for non-existent notebook", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Notebook not found" })),
      });

      const error = await deleteNotebook("nb_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should handle server errors during deletion after retries exhausted", async () => {
      // 500 errors are retried, so we need to exhaust retries
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ error: "Failed to delete notebook" })),
      });

      let caughtError: unknown;
      const promise = deleteNotebook("nb_123").catch((e) => {
        caughtError = e;
      });

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(caughtError).toBeInstanceOf(ApiError);
      expect((caughtError as ApiError).status).toBe(500);
    });
  });

  describe("duplicateNotebook", () => {
    it("should duplicate a notebook", async () => {
      const duplicatedNotebook: NotebookMeta = {
        id: "nb_dup",
        title: "Test Notebook (Copy)",
        createdAt: "2024-01-20T00:00:00Z",
        updatedAt: "2024-01-20T00:00:00Z",
        pageCount: 5,
        settings: mockNotebook.settings,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(duplicatedNotebook),
      });

      const result = await duplicateNotebook("nb_123");

      expect(result.id).not.toBe("nb_123");
      expect(result.pageCount).toBe(5);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks/nb_123/duplicate",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should throw ApiError for non-existent notebook", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Notebook not found" })),
      });

      const error = await duplicateNotebook("nb_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should preserve settings in duplicated notebook", async () => {
      const duplicatedNotebook: NotebookMeta = {
        id: "nb_dup",
        title: "Test Notebook (Copy)",
        createdAt: "2024-01-20T00:00:00Z",
        updatedAt: "2024-01-20T00:00:00Z",
        settings: {
          defaultTool: "highlighter",
          defaultColor: "#FF0000",
          defaultStrokeWidth: 4,
          gridType: "grid",
          backgroundLineSpacing: 30,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(duplicatedNotebook),
      });

      const result = await duplicateNotebook("nb_123");

      expect(result.settings).toEqual(duplicatedNotebook.settings);
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
          json: () => Promise.resolve([mockNotebook]),
        });

      globalThis.fetch = fetchMock;

      const promise = listNotebooks();

      // First attempt fails, then wait for retry
      await vi.advanceTimersByTimeAsync(1500);

      const result = await promise;
      expect(result).toEqual([mockNotebook]);
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

      await expect(createNotebook("Test")).rejects.toThrow(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    it("should handle unicode characters in notebook title", async () => {
      const unicodeTitle = "笔记本 📓 Тетрадь";
      const newNotebook: NotebookMeta = {
        id: "nb_unicode",
        title: unicodeTitle,
        createdAt: "2024-01-15T00:00:00Z",
        updatedAt: "2024-01-15T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(newNotebook),
      });

      const result = await createNotebook(unicodeTitle);
      expect(result.title).toBe(unicodeTitle);
    });

    it("should handle very long notebook ids", async () => {
      const longId = "nb_" + "a".repeat(100);
      const notebook: NotebookMeta = {
        id: longId,
        title: "Test",
        createdAt: "2024-01-15T00:00:00Z",
        updatedAt: "2024-01-15T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(notebook),
      });

      const result = await getNotebook(longId);
      expect(result.id).toBe(longId);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `/api/notebooks/${longId}`,
        expect.any(Object),
      );
    });

    it("should handle notebooks with zero pageCount", async () => {
      const emptyNotebook: NotebookMeta = {
        ...mockNotebook,
        pageCount: 0,
        coverPageId: null,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(emptyNotebook),
      });

      const result = await getNotebook("nb_empty");
      expect(result.pageCount).toBe(0);
    });

    it("should handle settings with only some fields", async () => {
      const partialSettings = {
        defaultTool: "pen" as const,
      };

      const notebookPartialSettings: NotebookMeta = {
        ...mockNotebook,
        settings: partialSettings,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(notebookPartialSettings),
      });

      const result = await getNotebook("nb_123");

      expect(result.settings?.defaultTool).toBe("pen");
      expect(result.settings?.defaultColor).toBeUndefined();
      expect(result.settings?.gridType).toBeUndefined();
    });
  });
});

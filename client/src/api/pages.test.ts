import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listPages,
  getPage,
  createPage,
  updatePage,
  deletePage,
  movePages,
  duplicatePage,
  type PageMeta,
} from "./pages";
import { ApiError } from "./client";

describe("pages API", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  const mockPage: PageMeta = {
    id: "pg_123",
    notebookId: "nb_456",
    pageNumber: 1,
    canvasX: 0,
    canvasY: 0,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  describe("listPages", () => {
    it("should fetch all pages for a notebook", async () => {
      const pages: PageMeta[] = [
        mockPage,
        { ...mockPage, id: "pg_456", pageNumber: 2 },
        { ...mockPage, id: "pg_789", pageNumber: 3 },
      ];

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pages),
      });

      const result = await listPages("nb_456");

      expect(result).toEqual(pages);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks/nb_456/pages",
        expect.objectContaining({
          headers: expect.any(Object),
        }),
      );
    });

    it("should return empty array when notebook has no pages", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      const result = await listPages("nb_empty");
      expect(result).toEqual([]);
    });

    it("should throw ApiError for non-existent notebook", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Notebook not found" })),
      });

      const error = await listPages("nb_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should throw ApiError on server error after retries exhausted", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ error: "Database error" })),
      });

      let caughtError: unknown;
      const promise = listPages("nb_456").catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(caughtError).toBeInstanceOf(ApiError);
      expect((caughtError as ApiError).status).toBe(500);
    });
  });

  describe("getPage", () => {
    it("should fetch a single page by id", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPage),
      });

      const result = await getPage("pg_123");

      expect(result).toEqual(mockPage);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123",
        expect.objectContaining({
          headers: expect.any(Object),
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

      const error = await getPage("pg_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
      expect(error.message).toBe("Page not found");
    });

    it("should handle page with links and tags", async () => {
      const pageWithMeta: PageMeta = {
        ...mockPage,
        links: ["pg_linked1", "pg_linked2"],
        tags: ["tag1", "tag2", "tag3"],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pageWithMeta),
      });

      const result = await getPage("pg_123");

      expect(result.links).toEqual(["pg_linked1", "pg_linked2"]);
      expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("should handle page with transcription metadata", async () => {
      const pageWithTranscription: PageMeta = {
        ...mockPage,
        transcription: {
          status: "completed",
          lastAttempt: "2024-01-15T12:00:00Z",
          error: null,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pageWithTranscription),
      });

      const result = await getPage("pg_123");

      expect(result.transcription).toEqual({
        status: "completed",
        lastAttempt: "2024-01-15T12:00:00Z",
        error: null,
      });
    });

    it("should handle page with failed transcription", async () => {
      const pageWithFailedTranscription: PageMeta = {
        ...mockPage,
        transcription: {
          status: "failed",
          lastAttempt: "2024-01-15T12:00:00Z",
          error: "API rate limit exceeded",
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pageWithFailedTranscription),
      });

      const result = await getPage("pg_123");

      expect(result.transcription?.status).toBe("failed");
      expect(result.transcription?.error).toBe("API rate limit exceeded");
    });

    it("should handle page without optional fields", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPage),
      });

      const result = await getPage("pg_123");

      expect(result.links).toBeUndefined();
      expect(result.tags).toBeUndefined();
      expect(result.transcription).toBeUndefined();
    });
  });

  describe("createPage", () => {
    it("should create a new page in a notebook", async () => {
      const newPage: PageMeta = {
        id: "pg_new",
        notebookId: "nb_456",
        pageNumber: 1,
        canvasX: 0,
        canvasY: 0,
        createdAt: "2024-01-15T00:00:00Z",
        updatedAt: "2024-01-15T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(newPage),
      });

      const result = await createPage("nb_456");

      expect(result).toEqual(newPage);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks/nb_456/pages",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should assign incremented page number", async () => {
      const newPage: PageMeta = {
        id: "pg_new",
        notebookId: "nb_456",
        pageNumber: 5,
        canvasX: 0,
        canvasY: 0,
        createdAt: "2024-01-15T00:00:00Z",
        updatedAt: "2024-01-15T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(newPage),
      });

      const result = await createPage("nb_456");
      expect(result.pageNumber).toBe(5);
    });

    it("should throw ApiError for non-existent notebook", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Notebook not found" })),
      });

      const error = await createPage("nb_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });
  });

  describe("updatePage", () => {
    it("should update canvas position", async () => {
      const updatedPage: PageMeta = {
        ...mockPage,
        canvasX: 100,
        canvasY: 200,
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedPage),
      });

      const result = await updatePage("pg_123", { canvasX: 100, canvasY: 200 });

      expect(result.canvasX).toBe(100);
      expect(result.canvasY).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ canvasX: 100, canvasY: 200 }),
        }),
      );
    });

    it("should update page number", async () => {
      const updatedPage: PageMeta = {
        ...mockPage,
        pageNumber: 5,
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedPage),
      });

      const result = await updatePage("pg_123", { pageNumber: 5 });

      expect(result.pageNumber).toBe(5);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ pageNumber: 5 }),
        }),
      );
    });

    it("should update page links", async () => {
      const updatedPage: PageMeta = {
        ...mockPage,
        links: ["pg_link1", "pg_link2", "pg_link3"],
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedPage),
      });

      const result = await updatePage("pg_123", { links: ["pg_link1", "pg_link2", "pg_link3"] });

      expect(result.links).toEqual(["pg_link1", "pg_link2", "pg_link3"]);
    });

    it("should update page tags", async () => {
      const updatedPage: PageMeta = {
        ...mockPage,
        tags: ["important", "todo", "review"],
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedPage),
      });

      const result = await updatePage("pg_123", { tags: ["important", "todo", "review"] });

      expect(result.tags).toEqual(["important", "todo", "review"]);
    });

    it("should clear links by setting empty array", async () => {
      const updatedPage: PageMeta = {
        ...mockPage,
        links: [],
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedPage),
      });

      const result = await updatePage("pg_123", { links: [] });

      expect(result.links).toEqual([]);
    });

    it("should clear tags by setting empty array", async () => {
      const updatedPage: PageMeta = {
        ...mockPage,
        tags: [],
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedPage),
      });

      const result = await updatePage("pg_123", { tags: [] });

      expect(result.tags).toEqual([]);
    });

    it("should update multiple fields together", async () => {
      const updates = {
        canvasX: 50,
        canvasY: 75,
        pageNumber: 3,
        links: ["pg_link1"],
        tags: ["tag1"],
      };

      const updatedPage: PageMeta = {
        ...mockPage,
        ...updates,
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedPage),
      });

      const result = await updatePage("pg_123", updates);

      expect(result.canvasX).toBe(50);
      expect(result.canvasY).toBe(75);
      expect(result.pageNumber).toBe(3);
      expect(result.links).toEqual(["pg_link1"]);
      expect(result.tags).toEqual(["tag1"]);
    });

    it("should handle empty updates", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPage),
      });

      const result = await updatePage("pg_123", {});

      expect(result).toEqual(mockPage);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123",
        expect.objectContaining({
          body: JSON.stringify({}),
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

      const error = await updatePage("pg_nonexistent", { canvasX: 0 }).catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should handle negative canvas coordinates", async () => {
      const updatedPage: PageMeta = {
        ...mockPage,
        canvasX: -100,
        canvasY: -200,
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedPage),
      });

      const result = await updatePage("pg_123", { canvasX: -100, canvasY: -200 });

      expect(result.canvasX).toBe(-100);
      expect(result.canvasY).toBe(-200);
    });
  });

  describe("deletePage", () => {
    it("should delete a page", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await deletePage("pg_123");

      expect(result).toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123",
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

      const error = await deletePage("pg_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should handle server errors during deletion after retries exhausted", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ error: "Failed to delete page" })),
      });

      let caughtError: unknown;
      const promise = deletePage("pg_123").catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(caughtError).toBeInstanceOf(ApiError);
      expect((caughtError as ApiError).status).toBe(500);
    });
  });

  describe("movePages", () => {
    it("should move single page to another notebook", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await movePages(["pg_123"], "nb_target");

      expect(result).toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/move",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ pageIds: ["pg_123"], targetNotebookId: "nb_target" }),
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should move multiple pages to another notebook", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const pageIds = ["pg_1", "pg_2", "pg_3"];
      const result = await movePages(pageIds, "nb_target");

      expect(result).toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/move",
        expect.objectContaining({
          body: JSON.stringify({ pageIds, targetNotebookId: "nb_target" }),
        }),
      );
    });

    it("should throw ApiError for non-existent target notebook", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "Target notebook not found" })),
      });

      const error = await movePages(["pg_123"], "nb_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
      expect(error.message).toBe("Target notebook not found");
    });

    it("should throw ApiError for non-existent pages", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ error: "One or more pages not found" })),
      });

      const error = await movePages(["pg_nonexistent"], "nb_target").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should handle empty page array", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await movePages([], "nb_target");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/move",
        expect.objectContaining({
          body: JSON.stringify({ pageIds: [], targetNotebookId: "nb_target" }),
        }),
      );
    });

    it("should handle validation errors", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve(JSON.stringify({ error: "Invalid request body" })),
      });

      const error = await movePages(["pg_123"], "nb_target").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(400);
    });
  });

  describe("duplicatePage", () => {
    it("should duplicate a page", async () => {
      const duplicatedPage: PageMeta = {
        id: "pg_dup",
        notebookId: "nb_456",
        pageNumber: 2,
        canvasX: 0,
        canvasY: 0,
        createdAt: "2024-01-20T00:00:00Z",
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(duplicatedPage),
      });

      const result = await duplicatePage("pg_123");

      expect(result.id).not.toBe("pg_123");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/pages/pg_123/duplicate",
        expect.objectContaining({
          method: "POST",
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

      const error = await duplicatePage("pg_nonexistent").catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });

    it("should preserve links and tags in duplicated page", async () => {
      const duplicatedPage: PageMeta = {
        id: "pg_dup",
        notebookId: "nb_456",
        pageNumber: 2,
        canvasX: 0,
        canvasY: 0,
        createdAt: "2024-01-20T00:00:00Z",
        updatedAt: "2024-01-20T00:00:00Z",
        links: ["pg_link1", "pg_link2"],
        tags: ["tag1", "tag2"],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(duplicatedPage),
      });

      const result = await duplicatePage("pg_123");

      expect(result.links).toEqual(["pg_link1", "pg_link2"]);
      expect(result.tags).toEqual(["tag1", "tag2"]);
    });

    it("should assign new page number in sequence", async () => {
      const duplicatedPage: PageMeta = {
        id: "pg_dup",
        notebookId: "nb_456",
        pageNumber: 10,
        canvasX: 0,
        canvasY: 0,
        createdAt: "2024-01-20T00:00:00Z",
        updatedAt: "2024-01-20T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(duplicatedPage),
      });

      const result = await duplicatePage("pg_123");
      expect(result.pageNumber).toBe(10);
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
          json: () => Promise.resolve([mockPage]),
        });

      globalThis.fetch = fetchMock;

      const promise = listPages("nb_456");
      await vi.advanceTimersByTimeAsync(1500);

      const result = await promise;
      expect(result).toEqual([mockPage]);
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

      await expect(updatePage("pg_123", { pageNumber: -1 })).rejects.toThrow(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should retry on network errors", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPage),
        });

      globalThis.fetch = fetchMock;

      const promise = getPage("pg_123");
      await vi.advanceTimersByTimeAsync(1500);

      const result = await promise;
      expect(result).toEqual(mockPage);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("should handle pages with very large canvas coordinates", async () => {
      const pageWithLargeCoords: PageMeta = {
        ...mockPage,
        canvasX: 999999999,
        canvasY: 999999999,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pageWithLargeCoords),
      });

      const result = await getPage("pg_123");

      expect(result.canvasX).toBe(999999999);
      expect(result.canvasY).toBe(999999999);
    });

    it("should handle pages with many links", async () => {
      const manyLinks = Array.from({ length: 100 }, (_, i) => `pg_link_${i}`);
      const pageWithManyLinks: PageMeta = {
        ...mockPage,
        links: manyLinks,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pageWithManyLinks),
      });

      const result = await getPage("pg_123");
      expect(result.links).toHaveLength(100);
    });

    it("should handle pages with many tags", async () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag_${i}`);
      const pageWithManyTags: PageMeta = {
        ...mockPage,
        tags: manyTags,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pageWithManyTags),
      });

      const result = await getPage("pg_123");
      expect(result.tags).toHaveLength(50);
    });

    it("should handle unicode characters in tags", async () => {
      const unicodeTags = ["日本語", "中文", "한국어", "العربية", "🏷️"];
      const pageWithUnicodeTags: PageMeta = {
        ...mockPage,
        tags: unicodeTags,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pageWithUnicodeTags),
      });

      const result = await getPage("pg_123");
      expect(result.tags).toEqual(unicodeTags);
    });

    it("should handle very long page ids", async () => {
      const longId = "pg_" + "a".repeat(100);
      const page: PageMeta = {
        ...mockPage,
        id: longId,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(page),
      });

      const result = await getPage(longId);
      expect(result.id).toBe(longId);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `/api/pages/${longId}`,
        expect.any(Object),
      );
    });

    it("should handle page number zero", async () => {
      const pageZero: PageMeta = {
        ...mockPage,
        pageNumber: 0,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pageZero),
      });

      const result = await getPage("pg_123");
      expect(result.pageNumber).toBe(0);
    });

    it("should handle pending transcription status", async () => {
      const pageWithPendingTranscription: PageMeta = {
        ...mockPage,
        transcription: {
          status: "pending",
          lastAttempt: null,
          error: null,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pageWithPendingTranscription),
      });

      const result = await getPage("pg_123");

      expect(result.transcription?.status).toBe("pending");
      expect(result.transcription?.lastAttempt).toBeNull();
    });

    it("should handle in_progress transcription status", async () => {
      const pageWithInProgressTranscription: PageMeta = {
        ...mockPage,
        transcription: {
          status: "transcribing",
          lastAttempt: "2024-01-15T12:00:00Z",
          error: null,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pageWithInProgressTranscription),
      });

      const result = await getPage("pg_123");
      expect(result.transcription?.status).toBe("transcribing");
    });

    it("should correctly encode special characters in notebook id", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      await listPages("nb_123-456_test");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notebooks/nb_123-456_test/pages",
        expect.any(Object),
      );
    });
  });
});

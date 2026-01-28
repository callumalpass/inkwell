import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchTranscriptions,
  type SearchResult,
  type SearchResponse,
  type MatchType,
} from "./search";
import { ApiError } from "./client";

describe("search API", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  const mockSearchResult: SearchResult = {
    pageId: "pg_123",
    notebookId: "nb_456",
    notebookName: "Test Notebook",
    excerpt: "This is a test transcription with matching text",
    modified: "2024-01-15T10:30:00Z",
    thumbnailUrl: "/api/pages/pg_123/thumbnail",
    tags: ["important", "todo"],
    matchType: "transcription",
    score: 0.85,
  };

  const mockSearchResponse: SearchResponse = {
    results: [mockSearchResult],
    total: 1,
    hasMore: false,
  };

  describe("searchTranscriptions", () => {
    describe("happy path", () => {
      it("should search with just a query string", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        const result = await searchTranscriptions("test query");

        expect(result).toEqual(mockSearchResponse);
        expect(globalThis.fetch).toHaveBeenCalledWith(
          "/api/search?q=test+query",
          expect.objectContaining({
            headers: expect.any(Object),
          }),
        );
      });

      it("should search with notebook filter", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        const result = await searchTranscriptions("notes", { notebook: "nb_456" });

        expect(result).toEqual(mockSearchResponse);
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("notebook=nb_456"),
          expect.any(Object),
        );
      });

      it("should search with limit option", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("test", { limit: 25 });

        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("limit=25"),
          expect.any(Object),
        );
      });

      it("should search with offset for pagination", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("test", { offset: 10 });

        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("offset=10"),
          expect.any(Object),
        );
      });

      it("should search with match type filter", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("test", { matchType: ["transcription", "tag"] });

        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("matchType=transcription%2Ctag"),
          expect.any(Object),
        );
      });

      it("should search with all options combined", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("meeting notes", {
          notebook: "nb_work",
          limit: 50,
          offset: 20,
          matchType: ["transcription"],
        });

        const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(url).toContain("q=meeting+notes");
        expect(url).toContain("notebook=nb_work");
        expect(url).toContain("limit=50");
        expect(url).toContain("offset=20");
        expect(url).toContain("matchType=transcription");
      });

      it("should return multiple results with pagination info", async () => {
        const paginatedResponse: SearchResponse = {
          results: [
            mockSearchResult,
            { ...mockSearchResult, pageId: "pg_124", score: 0.75 },
            { ...mockSearchResult, pageId: "pg_125", score: 0.65 },
          ],
          total: 50,
          hasMore: true,
        };

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(paginatedResponse),
        });

        const result = await searchTranscriptions("test");

        expect(result.results).toHaveLength(3);
        expect(result.total).toBe(50);
        expect(result.hasMore).toBe(true);
      });

      it("should return empty results when no matches found", async () => {
        const emptyResponse: SearchResponse = {
          results: [],
          total: 0,
          hasMore: false,
        };

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(emptyResponse),
        });

        const result = await searchTranscriptions("nonexistent content xyz");

        expect(result.results).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.hasMore).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should handle query with special characters", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("test & query + special");

        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("q=test+%26+query+%2B+special"),
          expect.any(Object),
        );
      });

      it("should handle unicode characters in query", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("笔记 notes Тест");

        // URLSearchParams encodes unicode correctly
        const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(url).toContain("q=");
        // Verify fetch was called successfully
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      });

      it("should handle empty options object", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("test", {});

        expect(globalThis.fetch).toHaveBeenCalledWith(
          "/api/search?q=test",
          expect.any(Object),
        );
      });

      it("should not include matchType when array is empty", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("test", { matchType: [] });

        const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(url).not.toContain("matchType");
      });

      it("should handle results with minimal data", async () => {
        const minimalResult: SearchResult = {
          pageId: "pg_min",
          notebookId: "nb_min",
          notebookName: "Minimal",
          excerpt: "",
          modified: "2024-01-01T00:00:00Z",
          thumbnailUrl: "/api/pages/pg_min/thumbnail",
          matchType: "transcription",
          score: 0,
        };

        const response: SearchResponse = {
          results: [minimalResult],
          total: 1,
          hasMore: false,
        };

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
        });

        const result = await searchTranscriptions("test");

        expect(result.results[0].tags).toBeUndefined();
        expect(result.results[0].excerpt).toBe("");
        expect(result.results[0].score).toBe(0);
      });

      it("should handle results with all match types", async () => {
        const matchTypes: MatchType[] = ["transcription", "tag", "notebook"];
        const results = matchTypes.map((matchType, i) => ({
          ...mockSearchResult,
          pageId: `pg_${i}`,
          matchType,
        }));

        const response: SearchResponse = {
          results,
          total: 3,
          hasMore: false,
        };

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
        });

        const result = await searchTranscriptions("test");

        expect(result.results[0].matchType).toBe("transcription");
        expect(result.results[1].matchType).toBe("tag");
        expect(result.results[2].matchType).toBe("notebook");
      });

      it("should handle results with large score values", async () => {
        const highScoreResult: SearchResult = {
          ...mockSearchResult,
          score: 1.0,
        };

        const response: SearchResponse = {
          results: [highScoreResult],
          total: 1,
          hasMore: false,
        };

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
        });

        const result = await searchTranscriptions("exact match");
        expect(result.results[0].score).toBe(1.0);
      });

      it("should handle whitespace-only query", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ results: [], total: 0, hasMore: false }),
        });

        await searchTranscriptions("   ");

        // URLSearchParams will encode the whitespace
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("q="),
          expect.any(Object),
        );
      });

      it("should handle very long query strings", async () => {
        const longQuery = "test ".repeat(100);

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions(longQuery);

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      });

      it("should preserve result order by score", async () => {
        const orderedResults: SearchResult[] = [
          { ...mockSearchResult, pageId: "pg_1", score: 0.95 },
          { ...mockSearchResult, pageId: "pg_2", score: 0.80 },
          { ...mockSearchResult, pageId: "pg_3", score: 0.65 },
          { ...mockSearchResult, pageId: "pg_4", score: 0.50 },
        ];

        const response: SearchResponse = {
          results: orderedResults,
          total: 4,
          hasMore: false,
        };

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
        });

        const result = await searchTranscriptions("test");

        expect(result.results[0].score).toBe(0.95);
        expect(result.results[1].score).toBe(0.80);
        expect(result.results[2].score).toBe(0.65);
        expect(result.results[3].score).toBe(0.50);
      });
    });

    describe("error handling", () => {
      it("should throw ApiError on 400 Bad Request", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: () => Promise.resolve(JSON.stringify({ error: "Invalid query parameter" })),
        });

        const error = await searchTranscriptions("test").catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(400);
        expect(error.message).toBe("Invalid query parameter");
      });

      it("should throw ApiError on 404 Not Found", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: () => Promise.resolve(JSON.stringify({ error: "Search endpoint not found" })),
        });

        const error = await searchTranscriptions("test").catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(404);
      });

      it("should retry and eventually throw on persistent 500 errors", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: () => Promise.resolve(JSON.stringify({ error: "Search service unavailable" })),
        });

        let caughtError: unknown;
        const promise = searchTranscriptions("test").catch((e) => {
          caughtError = e;
        });

        // Advance through all retries
        await vi.advanceTimersByTimeAsync(10000);
        await promise;

        expect(caughtError).toBeInstanceOf(ApiError);
        expect((caughtError as ApiError).status).toBe(500);
      });

      it("should retry on 503 Service Unavailable", async () => {
        const fetchMock = vi
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            text: () => Promise.resolve("Service temporarily down"),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockSearchResponse),
          });

        globalThis.fetch = fetchMock;

        const promise = searchTranscriptions("test");

        // Advance past retry delay
        await vi.advanceTimersByTimeAsync(1500);

        const result = await promise;
        expect(result).toEqual(mockSearchResponse);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      it("should not retry on 400 Bad Request", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: () => Promise.resolve("Invalid request"),
        });

        globalThis.fetch = fetchMock;

        await expect(searchTranscriptions("test")).rejects.toThrow(ApiError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      it("should handle network errors with retries", async () => {
        const fetchMock = vi
          .fn()
          .mockRejectedValueOnce(new TypeError("Failed to fetch"))
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockSearchResponse),
          });

        globalThis.fetch = fetchMock;

        const promise = searchTranscriptions("test");

        await vi.advanceTimersByTimeAsync(1500);

        const result = await promise;
        expect(result).toEqual(mockSearchResponse);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
    });

    describe("URL construction", () => {
      it("should construct correct base URL", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("test");

        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringMatching(/^\/api\/search\?/),
          expect.any(Object),
        );
      });

      it("should properly encode query parameter", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("hello world");

        expect(globalThis.fetch).toHaveBeenCalledWith(
          "/api/search?q=hello+world",
          expect.any(Object),
        );
      });

      it("should handle single match type filter", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("test", { matchType: ["tag"] });

        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("matchType=tag"),
          expect.any(Object),
        );
      });

      it("should handle multiple match types separated by comma", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("test", { matchType: ["transcription", "tag", "notebook"] });

        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("matchType=transcription%2Ctag%2Cnotebook"),
          expect.any(Object),
        );
      });

      it("should handle limit of 0", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ results: [], total: 0, hasMore: false }),
        });

        await searchTranscriptions("test", { limit: 0 });

        // 0 is falsy so should not be included
        const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(url).not.toContain("limit=");
      });

      it("should handle offset of 0", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

        await searchTranscriptions("test", { offset: 0 });

        // 0 is falsy so should not be included
        const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(url).not.toContain("offset=");
      });
    });
  });
});

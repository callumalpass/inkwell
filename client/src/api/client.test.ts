import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, ApiError } from "./client";

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("should return JSON response for successful requests", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: "test" }),
    });

    const result = await apiFetch<{ data: string }>("/test");
    expect(result).toEqual({ data: "test" });
  });

  it("should return undefined for 204 No Content responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await apiFetch("/test");
    expect(result).toBeUndefined();
  });

  it("should throw ApiError for non-ok responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ error: "Page not found" })),
    });

    const error = await apiFetch("/test", { maxRetries: 0 }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      message: "Page not found",
      retryable: false,
    });
  });

  it("should retry on 503 Service Unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: () => Promise.resolve("Service temporarily unavailable"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

    globalThis.fetch = fetchMock;

    const promise = apiFetch<{ success: boolean }>("/test", { maxRetries: 3 });

    // First attempt fails immediately, then we wait for retry delay
    await vi.advanceTimersByTimeAsync(1500); // 1s base + jitter

    const result = await promise;
    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should retry on 500 Internal Server Error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Server error"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ recovered: true }),
      });

    globalThis.fetch = fetchMock;

    const promise = apiFetch<{ recovered: boolean }>("/test", { maxRetries: 1 });
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result).toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should retry on 429 Too Many Requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: () => Promise.resolve("Rate limited"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: "ok" }),
      });

    globalThis.fetch = fetchMock;

    const promise = apiFetch<{ data: string }>("/test", { maxRetries: 1 });
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result).toEqual({ data: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should NOT retry on 400 Bad Request", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: () => Promise.resolve("Invalid input"),
    });

    globalThis.fetch = fetchMock;

    await expect(apiFetch("/test", { maxRetries: 3 })).rejects.toThrow(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should NOT retry on 401 Unauthorized", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: () => Promise.resolve("Authentication required"),
    });

    globalThis.fetch = fetchMock;

    await expect(apiFetch("/test", { maxRetries: 3 })).rejects.toThrow(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should retry on network errors (TypeError)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ recovered: true }),
      });

    globalThis.fetch = fetchMock;

    const promise = apiFetch<{ recovered: boolean }>("/test", { maxRetries: 1 });
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result).toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should use exponential backoff for retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: () => Promise.resolve("Down"),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: () => Promise.resolve("Still down"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });

    globalThis.fetch = fetchMock;

    const promise = apiFetch<{ ok: boolean }>("/test", { maxRetries: 3 });

    // First call happens immediately
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // First retry after ~1s (base delay)
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second retry after ~2s (2x base delay)
    await vi.advanceTimersByTimeAsync(2500);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toEqual({ ok: true });
  });

  it("should exhaust retries and throw final error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: () => Promise.resolve("Always down"),
    });

    globalThis.fetch = fetchMock;

    // Catch immediately to prevent unhandled rejection
    let caughtError: unknown;
    const promise = apiFetch("/test", { maxRetries: 2 }).catch((e) => {
      caughtError = e;
    });

    // Advance through all retries
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(caughtError).toMatchObject({
      status: 503,
      retryable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("should respect maxRetries: 0 to disable retries", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: () => Promise.resolve("Down"),
    });

    globalThis.fetch = fetchMock;

    await expect(apiFetch("/test", { maxRetries: 0 })).rejects.toThrow(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should set Content-Type header for requests with body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ created: true }),
    });

    await apiFetch("/test", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("should parse JSON error messages", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      text: () => Promise.resolve(JSON.stringify({ message: "Validation failed" })),
    });

    await expect(apiFetch("/test", { maxRetries: 0 })).rejects.toMatchObject({
      message: "Validation failed",
    });
  });

  it("should handle non-JSON error responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      text: () => Promise.resolve("<html>Bad Gateway</html>"),
    });

    const promise = apiFetch("/test", { maxRetries: 0 });

    await expect(promise).rejects.toMatchObject({
      message: "<html>Bad Gateway</html>",
    });
  });
});

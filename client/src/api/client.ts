const BASE_URL = "/api";

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Default number of retry attempts for retryable errors. */
const DEFAULT_MAX_RETRIES = 3;

/** Base delay in milliseconds for exponential backoff (doubles each retry). */
const BASE_RETRY_DELAY_MS = 1000;

/** HTTP status codes that are safe to retry (transient errors). */
const RETRYABLE_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Whether this error is retryable (transient). */
    public retryable: boolean = false,
  ) {
    super(message);
  }
}

/** Parse the error response body, preferring a JSON `error` or `message` field. */
async function parseErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (typeof json.error === "string") return json.error;
      if (typeof json.message === "string") return json.message;
    } catch {
      // Not JSON — use plain text, but cap length to avoid huge HTML pages
    }
    return text.length > 200 ? text.slice(0, 200) + "…" : text;
  } catch {
    return res.statusText || "Unknown error";
  }
}

/** Check if an error is retryable (network error or transient HTTP status). */
function isRetryableError(error: unknown): boolean {
  // Network errors (fetch failed, timeout, etc.)
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  // API errors with retryable status codes
  if (error instanceof ApiError) return error.retryable;
  return false;
}

/** Calculate delay for exponential backoff with jitter. */
function getRetryDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, etc.
  const baseDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(baseDelay + jitter);
}

/** Sleep for a given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ApiFetchOptions extends RequestInit {
  /** Maximum number of retry attempts (default: 3). Set to 0 to disable retries. */
  maxRetries?: number;
  /** Request timeout in milliseconds (default: 30000). */
  timeoutMs?: number;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...fetchOptions
  } = options;

  const headers: Record<string, string> = { ...fetchOptions.headers as Record<string, string> };
  if (fetchOptions.body) {
    headers["Content-Type"] = "application/json";
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Wait before retry (skip on first attempt)
    if (attempt > 0) {
      const delay = getRetryDelay(attempt - 1);
      await sleep(delay);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        ...fetchOptions,
        headers,
        signal: fetchOptions.signal ?? controller.signal,
      });

      if (!res.ok) {
        const message = await parseErrorBody(res);
        const retryable = RETRYABLE_STATUS_CODES.has(res.status);
        throw new ApiError(res.status, message, retryable);
      }

      if (res.status === 204) return undefined as T;
      return res.json();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts or error is not retryable
      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error;
      }
      // Otherwise, loop continues to retry
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Should never reach here, but TypeScript doesn't know that
  throw lastError;
}

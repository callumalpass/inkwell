const BASE_URL = "/api";

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });

    if (!res.ok) {
      const message = await parseErrorBody(res);
      throw new ApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Tiny typed fetch wrapper for the NexClean API.
 * - Prefixes requests with VITE_API_URL (default localhost:4000/api)
 * - Attaches the bearer token from a getter (set by the session store)
 * - Unwraps the { success, data, message } envelope and throws ApiError
 */
export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:4000/api";

type TokenSource = { prefix: string; get: () => string | null };
const tokenSources: TokenSource[] = [];

/**
 * Register a token getter for a route prefix (e.g. "/app", "/agent", "/admin").
 * Each role keeps its own session, and the client picks the token whose prefix
 * matches the current path — so all three apps can be open without clashing.
 */
export function registerAuthToken(prefix: string, get: () => string | null) {
  tokenSources.push({ prefix, get });
}

function currentToken(): string | null {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const match = tokenSources.find((s) => path.startsWith(s.prefix));
  return match ? match.get() : null;
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = currentToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* empty / non-JSON response */
  }

  const envelope = payload as { success?: boolean; data?: T; message?: string; details?: unknown } | null;

  if (!res.ok || (envelope && envelope.success === false)) {
    throw new ApiError(
      res.status,
      envelope?.message || `Request failed (${res.status})`,
      envelope?.details,
    );
  }

  return (envelope?.data as T) ?? (payload as T);
}

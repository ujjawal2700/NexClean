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

const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")) {
    return `${window.location.origin}/api`;
  }
  return "http://localhost:4000/api";
};

export const API_URL = getApiUrl();

// Base URL for the socket.io connection, derived from API_URL. When API_URL
// is a relative path (e.g. "/api", self-hosted behind one nginx origin),
// this resolves to undefined so socket.io-client defaults to the current
// page origin — passing "" explicitly does not do the same thing and breaks
// the connection.
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, "") || undefined;

type TokenSource = { prefix: string; get: () => string | null; role: SessionRole };
const tokenSources: TokenSource[] = [];

export type SessionRole = "customer" | "agent" | "admin";

/** Which app the current path belongs to, so the API picks the right session. */
function currentRole(): SessionRole | null {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const match = tokenSources.find((s) => path.startsWith(s.prefix));
  return match?.role ?? null;
}

/**
 * Register a token getter for a route prefix (e.g. "/app", "/agent", "/admin").
 * Each role keeps its own session, and the client picks the token whose prefix
 * matches the current path — so all three apps can be open without clashing.
 */
export function registerAuthToken(prefix: string, get: () => string | null, role: SessionRole) {
  tokenSources.push({ prefix, get, role });
}

function currentToken(): string | null {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const match = tokenSources.find((s) => path.startsWith(s.prefix));
  if (match) {
    const t = match.get();
    if (t) return t;
  }
  for (const s of tokenSources) {
    const t = s.get();
    if (t) return t;
  }
  return null;
}

const DEVICE_ID_KEY = "nexclean-device-id";

/** A stable id for this browser/install, created on first use. */
function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return ""; // private mode / storage blocked — degrade quietly
  }
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = currentToken();

  const role = currentRole();

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    // The session is an httpOnly cookie the browser attaches for us — it is
    // deliberately unreadable from JavaScript, so an XSS can no longer steal a
    // long-lived credential the way it could from localStorage.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      // Tells the API which of the three role cookies to use, mirroring the
      // route-prefix logic below so all three apps can be open at once.
      ...(role ? { "X-Session-Role": role } : {}),
      // Legacy fallback: only present for sessions established before the
      // cookie migration, so existing logins survive the deploy.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Stable per-install id. The server pairs it with the request IP purely
      // to spot one person farming referral bonuses across many phone numbers;
      // it is not used for tracking or to block signups.
      ...(deviceId() ? { "X-Device-Id": deviceId() } : {}),
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

  // A response wrapped in the {success, data} envelope always yields
  // envelope.data, even when that's legitimately null (e.g. "no current
  // offer") — falling back to the raw payload only when there's no
  // envelope at all. `data: null ?? payload` previously mistook a real
  // null for "no envelope" and returned the whole {success, data} object
  // instead, which every caller's `if (result)` then treated as truthy.
  if (envelope && typeof envelope === "object" && "data" in envelope) {
    return envelope.data as T;
  }
  return payload as T;
}

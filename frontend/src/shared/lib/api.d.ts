/**
 * Tiny typed fetch wrapper for the NexClean API.
 * - Prefixes requests with VITE_API_URL (default localhost:4000/api)
 * - Attaches the bearer token from a getter (set by the session store)
 * - Unwraps the { success, data, message } envelope and throws ApiError
 */
export declare class ApiError extends Error {
    status: number;
    details?: unknown;
    constructor(status: number, message: string, details?: unknown);
}
export declare const API_URL: string;
export declare const SOCKET_URL: string | undefined;
/**
 * Register a token getter for a route prefix (e.g. "/app", "/agent", "/admin").
 * Each role keeps its own session, and the client picks the token whose prefix
 * matches the current path — so all three apps can be open without clashing.
 */
export declare function registerAuthToken(prefix: string, get: () => string | null): void;
type ApiOptions = Omit<RequestInit, "body"> & {
    body?: unknown;
};
export declare function apiFetch<T>(path: string, options?: ApiOptions): Promise<T>;
export {};

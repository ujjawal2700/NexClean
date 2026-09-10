import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL } from "../playwright.config";

/**
 * Playwright's `request` fixture resolves relative URLs via WHATWG `new URL(path, baseURL)`
 * semantics: a path starting with "/" is absolute-path and DISCARDS any path segment already
 * in `baseURL` (e.g. `new URL("/health", "http://localhost:4000/api")` -> ".../health", not
 * ".../api/health"). Since `API_BASE_URL` has a path segment ("/api") and every spec in this
 * suite writes leading-slash paths like `request.get("/health")`, the built-in fixture silently
 * 404s on every call. It also doesn't help e2e projects, whose `baseURL` is the frontend origin
 * (no /api at all) — `request` calls there need the backend origin regardless of the project.
 *
 * Fix: every spec imports `test`/`expect` from here instead of "@playwright/test" (only the
 * import line changes, no other code) and gets a `request` fixture that always resolves against
 * `API_BASE_URL`, independent of the project's configured `baseURL` and regardless of leading
 * slashes in the path.
 */
const API_METHODS = ["get", "post", "patch", "put", "delete", "head", "fetch"] as const;

function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export const test = base.extend({
  request: async ({ request }, use) => {
    const wrapped = new Proxy(request, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function" && (API_METHODS as readonly string[]).includes(prop as string)) {
          return (path: string, ...rest: unknown[]) => (value as (...a: unknown[]) => unknown).apply(target, [resolveApiUrl(path), ...rest]);
        }
        return value;
      },
    });
    await use(wrapped);
  },
});

export { expect, type APIRequestContext };

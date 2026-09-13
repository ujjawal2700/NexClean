import { request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";
import { DEMO_OTP, authHeader, freshPhone } from "./api-client";
import { API_BASE_URL } from "../playwright.config";

/**
 * Playwright's ambient `request` fixture is bound to whatever `baseURL` the
 * active project sets — for the admin-e2e project that's the FRONTEND
 * (http://localhost:5173, so relative calls like `loginByPhone`'s
 * `request.post("/auth/send-otp")` would silently hit Vite instead of the
 * API and fail with "Unexpected end of JSON input"). Backend-seeding calls
 * from admin e2e specs (seeding a customer/lead/ticket via the real API)
 * must use a request context bound to the real API instead.
 *
 * IMPORTANT: this context is created with NO baseURL, and every call site
 * must use a FULL absolute URL (`${API_BASE_URL}/...`), never a relative
 * path. Discovered while writing these specs: Playwright's request context
 * resolves a relative path starting with "/" against a configured baseURL
 * using standard URL-merge semantics, which — when the baseURL itself has a
 * path component like "http://localhost:4000/api" — REPLACES that path
 * entirely instead of appending to it (e.g. baseURL
 * "http://localhost:4000/api" + relative "/auth/send-otp" resolves to
 * "http://localhost:4000/auth/send-otp", silently dropping "/api" and
 * 404ing / "route not found"ing). This also means `loginAsNewCustomer` /
 * `loginByPhone` / `loginAsAdmin` from `fixtures/api-client.ts` (which all
 * call `request.post("/auth/...")` with a relative path) do NOT work
 * against a context built by this helper — use `mintTokenForPhone` /
 * `loginAsFreshCustomer` below instead, which use absolute URLs throughout.
 * This is a suspected pre-existing bug in the shared `playwright.config.ts`
 * API_BASE_URL / `fixtures/api-client.ts` relative-path combo (reproduces
 * against the standalone `tests/api/*.spec.ts` suite too), not something
 * introduced here — flagged in the final report rather than fixed directly
 * since both those files are shared/out of this task's scope. Mirrors the
 * same workaround already adopted in `tests/fixtures/customer-e2e-helpers.ts`.
 */
export async function apiContext(): Promise<APIRequestContext> {
  return pwRequest.newContext();
}

/**
 * Mints a bearer token for a phone via the real OTP flow (send + verify with
 * the always-valid demo code), using full absolute URLs — see the module
 * doc above for why this doesn't just call `loginByPhone` from
 * `fixtures/api-client.ts` directly. Mirrors that function's behavior/shape.
 */
export async function mintTokenForPhone(
  api: APIRequestContext,
  phone: string,
): Promise<{ token: string; userId: string }> {
  await api.post(`${API_BASE_URL}/auth/send-otp`, { data: { phone } });
  const res = await api.post(`${API_BASE_URL}/auth/verify-otp`, { data: { phone, code: DEMO_OTP } });
  const body = (await res.json()) as {
    success?: boolean;
    data?: { token: string; user: { id: string } };
    message?: string;
  };
  if (!res.ok() || body.success === false || !body.data) {
    throw new Error(`verify-otp failed: ${body.message ?? JSON.stringify(body)}`);
  }
  return { token: body.data.token, userId: body.data.user.id };
}

/** Mints a token for a fresh, never-before-seen customer phone. */
export async function loginAsFreshCustomer(api: APIRequestContext) {
  const phone = freshPhone();
  // A fresh phone must be registered before it can verify an OTP, or
  // verify-otp rejects it as NOT_REGISTERED — same absolute-URL requirement
  // as everything else in this file, see the module doc above.
  await api.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone } });
  return mintTokenForPhone(api, phone);
}

/** PATCH the given customer's display name via a full absolute URL. */
export async function setCustomerName(api: APIRequestContext, token: string, name: string) {
  const res = await api.patch(`${API_BASE_URL}/users/me`, { headers: authHeader(token), data: { name } });
  if (!res.ok()) throw new Error(`PATCH /users/me failed: ${res.status()}`);
  return res;
}

/**
 * Locates the nearest GlassCard (the shared `.glass` container class used
 * across every admin page) that contains the given text. Most admin
 * CATALOG/CONFIG pages render un-id'd repeating cards/rows (categories,
 * plans, coupons, roles, ...), so scoping actions ("click Edit", "click
 * trash") to the card containing a known unique label (e.g. a freshly
 * created record's name) is the most reliable way to target the right one
 * without a `data-testid`.
 */
export function cardByText(page: Page, text: string | RegExp) {
  return page.locator(".glass").filter({ hasText: text });
}

/**
 * Like `cardByText`, but returns a *positional* locator (`.glass` at
 * whatever index currently matches `text`) instead of a live text-filtered
 * one. Needed wherever entering an edit state swaps the matched text into
 * an editable `<input value="...">` — an input's `value` isn't part of the
 * element's `textContent`, so a live `hasText` filter loses the match the
 * instant editing starts (e.g. Vehicle Categories' inline name field).
 * Call this once, before triggering the state change that would break a
 * live `hasText` filter, and reuse the returned locator afterwards.
 */
export async function pinCardByText(page: Page, text: string | RegExp) {
  const cards = page.locator(".glass");
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    const t = await cards.nth(i).innerText();
    if (typeof text === "string" ? t.includes(text) : text.test(t)) {
      return cards.nth(i);
    }
  }
  throw new Error(`pinCardByText: no ".glass" card matching ${text} found`);
}

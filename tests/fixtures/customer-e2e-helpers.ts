import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import { DEMO_OTP, authHeader } from "./api-client";
import { API_BASE_URL } from "../playwright.config";

/**
 * Playwright's ambient `request` fixture is bound to whatever `baseURL` the
 * active project sets — for the customer-e2e project that's the FRONTEND
 * (http://localhost:5173), not the API. Backend-seeding calls from customer
 * e2e specs need their own context.
 *
 * IMPORTANT: this context is intentionally created with NO baseURL, and every
 * call site below uses a FULL absolute URL (`${API_BASE_URL}/...`) rather
 * than a relative path. Discovered while writing these specs: Playwright's
 * request context resolves a relative path starting with "/" against
 * baseURL using standard URL-merge semantics, which — when baseURL itself
 * has a path component like "http://localhost:4000/api" — REPLACES that
 * path entirely instead of appending to it (e.g. baseURL
 * "http://localhost:4000/api" + relative "/auth/send-otp" resolves to
 * "http://localhost:4000/auth/send-otp", silently dropping "/api" and
 * 404ing). Verified this isn't a one-off: it reproduces the exact same way
 * against the pre-existing `tests/api/*.spec.ts` suite too (e.g.
 * `npx playwright test --project=api catalog.spec.ts` — every relative-path
 * call currently 404s in this environment), so it's a suspected bug in the
 * shared `playwright.config.ts` API_BASE_URL / `fixtures/api-client.ts`
 * relative-path combo, not something introduced here. Flagged in the final
 * report rather than fixed directly since both those files are shared /
 * out of this task's scope — every helper in this file works around it by
 * always using full absolute URLs instead of relying on baseURL merging.
 */
export async function apiContext(): Promise<APIRequestContext> {
  return pwRequest.newContext();
}

/**
 * Mints a bearer token for a phone via the real OTP flow (send + verify with
 * the always-valid demo code), using full absolute URLs — see the module
 * doc above for why this doesn't just call `loginByPhone` from
 * `fixtures/api-client.ts` directly. Mirrors that function's behavior/shape.
 *
 * verify-otp no longer upserts an account on a fresh phone — it requires one
 * to already exist (see auth.service.ts's verifyOtp: NOT_REGISTERED if
 * User.findOne comes back empty), so this registers the phone first. Signup
 * alone doesn't mint a session, so it doesn't change what this returns.
 */
export async function mintTokenForPhone(
  api: APIRequestContext,
  phone: string,
): Promise<{ token: string; userId: string }> {
  await api.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone } });
  await api.post(`${API_BASE_URL}/auth/send-otp`, { data: { phone } });
  const res = await api.post(`${API_BASE_URL}/auth/verify-otp`, { data: { phone, code: DEMO_OTP } });
  const body = (await res.json()) as { success?: boolean; data?: { token: string; user: { id: string } }; message?: string };
  if (!res.ok() || body.success === false || !body.data) {
    throw new Error(`verify-otp failed: ${body.message ?? JSON.stringify(body)}`);
  }
  return { token: body.data.token, userId: body.data.user.id };
}

/** GET the first catalog package id, via a full absolute URL. */
export async function firstPackageId(api: APIRequestContext): Promise<string> {
  const res = await api.get(`${API_BASE_URL}/catalog/packages`);
  const body = await res.json();
  return body.data[0].id;
}

/** POST a booking for the given token, via a full absolute URL. */
export async function createBooking(api: APIRequestContext, token: string, payload: Record<string, unknown>) {
  const res = await api.post(`${API_BASE_URL}/bookings`, { headers: authHeader(token), data: payload });
  return res.json();
}

/**
 * Seeds a vehicle + address for a customer via the real API, so UI specs
 * that need pre-existing garage/address data (booking flow, subscriptions)
 * don't have to click through those forms every single test. Call after
 * minting a token for the SAME phone the UI session is logged in as (see
 * `mintTokenForPhone` above) so the seeded data shows up in the UI.
 */
export async function seedVehicleAndAddress(
  api: APIRequestContext,
  token: string,
  opts: { vehicleType?: string; vehicleName?: string; addressLabel?: string; addressLine?: string } = {},
) {
  const vehicleRes = await api.post(`${API_BASE_URL}/users/me/vehicles`, {
    headers: authHeader(token),
    data: {
      type: opts.vehicleType ?? "hatchback",
      name: opts.vehicleName ?? "Test Hatchback",
      plate: "TS 01 AB 1234",
    },
  });
  const addressRes = await api.post(`${API_BASE_URL}/users/me/addresses`, {
    headers: authHeader(token),
    data: {
      label: opts.addressLabel ?? "Home",
      line: opts.addressLine ?? "123 Test Street, Indore",
      lat: 22.7196,
      lng: 75.8577,
    },
  });
  return {
    vehicles: (await vehicleRes.json()).data.vehicles,
    addresses: (await addressRes.json()).data.addresses,
  };
}

import type { APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { authHeader, freshPhone, DEMO_OTP } from "./api-client";

/**
 * Helpers shared across the "operational half" admin e2e specs
 * (login/dashboard/bookings/dispatch/agents/agent-verification/agent-detail/customers/payments).
 * Kept separate from fixtures/ui-helpers.ts and fixtures/api-client.ts (shared, do not edit).
 *
 * IMPORTANT — why every request below goes through apiUrl() instead of a bare
 * "/path": the "admin-e2e" Playwright project (see tests/playwright.config.ts)
 * sets `baseURL: WEB_BASE_URL` (the *frontend*, http://localhost:5173) for
 * its `page` AND its `request` fixture. fixtures/api-client.ts's helpers
 * (loginAsNewCustomer, loginByPhone, etc.) call `request.post("/bookings")`
 * etc with a leading slash, which resolves — per WHATWG URL rules, exactly
 * what Playwright's APIRequestContext uses — against the frontend origin,
 * not the backend. Confirmed directly: `curl -X POST
 * http://localhost:5173/auth/send-otp` returns a real 404 with an EMPTY
 * body, which is exactly the "Unexpected end of JSON input" seen when
 * fixtures/api-client.ts's `unwrap()` calls `res.json()` on it. So inside
 * e2e/admin/*.spec.ts (project "admin-e2e"), api-client.ts's request-making
 * helpers are silently broken — only its pure constants (ADMIN_EMAIL,
 * SEED_AGENT_PHONE, freshPhone(), authHeader(), DEMO_OTP, ...) are safe to
 * reuse. Every seed helper here re-implements the tiny bit of login/booking
 * logic it needs against an explicit absolute backend URL instead.
 */
const API_ROOT = process.env.API_BASE_URL ?? "http://localhost:4000/api";
export function apiUrl(path: string): string {
  return `${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
}

async function unwrap<T>(res: { ok: () => boolean; json: () => Promise<unknown>; text: () => Promise<string> }, label: string): Promise<T> {
  let parsed: { success?: boolean; data?: T; message?: string } | null = null;
  try {
    parsed = (await res.json()) as { success?: boolean; data?: T; message?: string };
  } catch {
    // fall through — body wasn't JSON (or was empty); report status + raw text below.
  }
  if (!res.ok() || !parsed || parsed.success === false) {
    throw new Error(`${label} failed (ok=${res.ok()}): ${parsed ? JSON.stringify(parsed) : "<non-JSON body>"}`);
  }
  return parsed.data as T;
}

/** Real OTP login against the actual backend origin (see the apiUrl() note above). */
export async function loginByPhoneApi(request: APIRequestContext, phone: string): Promise<{ token: string; userId: string }> {
  await request.post(apiUrl("/auth/send-otp"), { data: { phone } });
  const res = await request.post(apiUrl("/auth/verify-otp"), { data: { phone, code: DEMO_OTP } });
  const data = await unwrap<{ token: string; user: { id: string } }>(res, "verify-otp");
  return { token: data.token, userId: data.user.id };
}

export async function loginAsNewCustomerApi(request: APIRequestContext) {
  const phone = freshPhone();
  await request.post(apiUrl("/auth/customer/signup"), { data: { name: "Test Customer", phone } });
  return loginByPhoneApi(request, phone);
}

// Indore-ish coordinates matching the seeded demo agents' area (see tests/api/booking.spec.ts).
export const NEAR_LAT = 22.7196;
export const NEAR_LNG = 75.8577;

/** A 1x1 transparent PNG data URI — the minimum shape agentSignupSchema accepts for Aadhar photos. */
export const TINY_IMAGE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * Retries a flaky async op a few times. Other agents run their own e2e
 * suites concurrently against this same local dev backend, which under
 * combined load can occasionally still hiccup even with the right URL.
 * Safe to retry: every helper below creates brand-new, uniquely-identified
 * records (fresh phone/name) — a retry just leaves one harmless extra row
 * in the disposable test DB.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export async function firstPackageId(request: APIRequestContext): Promise<string> {
  const body = await (await request.get(apiUrl("/catalog/packages"))).json();
  return body.data[0].id;
}

function bookingDraft(packageId: string, extra: Record<string, unknown> = {}) {
  return {
    vehicleType: "hatchback",
    vehicleName: "Test Car",
    packageId,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    slot: "11:00 AM",
    addressLabel: "Home",
    addressLine: "123 Test Street",
    ...extra,
  };
}

/**
 * Creates a fresh customer + a real booking with coordinates near the seeded
 * agents (so it's assignable / visible on the Bookings & Dispatch admin pages).
 */
export async function seedAssignableBooking(request: APIRequestContext) {
  return withRetry(async () => {
    const { token: customerToken } = await loginAsNewCustomerApi(request);
    const packageId = await firstPackageId(request);
    const res = await request.post(apiUrl("/bookings"), {
      headers: authHeader(customerToken),
      data: bookingDraft(packageId, { lat: NEAR_LAT, lng: NEAR_LNG }),
    });
    if (!res.ok()) throw new Error(`seedAssignableBooking failed: ${await res.text()}`);
    const body = await res.json();
    return { booking: body.data as { id: string }, customerToken };
  });
}

/**
 * Creates a fresh customer + a booking WITHOUT coordinates, which per the
 * dispatch pipeline routes straight to dispatchStatus "pending_admin" —
 * i.e. it lands in the admin Dispatch queue needing manual assignment.
 *
 * The dispatch page has no search box, so we stamp a unique marker into the
 * addressLine (shown in the queue row when there's no `society`) so the UI
 * test can find *this* exact row even with other agents seeding data
 * concurrently against the same shared dev DB.
 */
export async function seedPendingAdminBooking(request: APIRequestContext, marker: string) {
  return withRetry(async () => {
    const { token: customerToken } = await loginAsNewCustomerApi(request);
    const packageId = await firstPackageId(request);
    const res = await request.post(apiUrl("/bookings"), {
      headers: authHeader(customerToken),
      data: bookingDraft(packageId, { addressLine: `123 Test Street — ${marker}` }),
    });
    if (!res.ok()) throw new Error(`seedPendingAdminBooking failed: ${await res.text()}`);
    const body = await res.json();
    // Dispatch runs fire-and-forget right after creation; give it a beat to settle.
    await new Promise((r) => setTimeout(r, 600));
    return { booking: body.data as { id: string }, customerToken };
  });
}

/** Registers a brand-new agent (pending KYC review) via the real signup API, self-contained per-test. */
export async function seedPendingAgent(request: APIRequestContext, namePrefix = "Test Pending Agent") {
  return withRetry(async () => {
    const phone = freshPhone();
    const name = `${namePrefix} ${phone.slice(-4)}`;
    const res = await request.post(apiUrl("/auth/agent/signup"), {
      data: {
        name,
        phone,
        area: "Test Area",
        aadharNumber: "123456789012",
        aadharFront: TINY_IMAGE_DATA_URI,
        aadharBack: TINY_IMAGE_DATA_URI,
      },
    });
    if (!res.ok()) {
      throw new Error(`seedPendingAgent failed: ${await res.text()}`);
    }
    return { phone, name };
  });
}

/** Creates a fresh customer with a findable name (via PATCH /users/me) for Customers-page UI tests. */
export async function seedNamedCustomer(request: APIRequestContext, name: string) {
  return withRetry(async () => {
    const phone = freshPhone();
    // A fresh phone must be registered before it can verify an OTP — see
    // loginAsNewCustomerApi, which does the same signup step. Without this,
    // verify-otp rejects the phone as NOT_REGISTERED.
    await request.post(apiUrl("/auth/customer/signup"), { data: { name: "Test Customer", phone } });
    const { token, userId } = await loginByPhoneApi(request, phone);
    const res = await request.patch(apiUrl("/users/me"), { headers: authHeader(token), data: { name } });
    if (!res.ok()) {
      throw new Error(`seedNamedCustomer failed: ${await res.text()}`);
    }
    return { phone, token, userId, name };
  });
}

/** Creates a real Payment + Booking via the mock payment order/verify flow (see tests/api/payment.spec.ts). */
export async function seedPayment(request: APIRequestContext) {
  return withRetry(async () => {
    const { token: customerToken, userId } = await loginAsNewCustomerApi(request);
    const packageId = await firstPackageId(request);
    const booking = bookingDraft(packageId, { lat: NEAR_LAT, lng: NEAR_LNG });

    const order = await request.post(apiUrl("/payments/order"), { headers: authHeader(customerToken), data: { booking } });
    if (!order.ok()) throw new Error(`seedPayment order failed: ${await order.text()}`);
    const orderBody = (await order.json()).data as { orderId: string };

    const verify = await request.post(apiUrl("/payments/verify"), {
      headers: authHeader(customerToken),
      data: { booking, razorpay_order_id: orderBody.orderId },
    });
    if (!verify.ok()) throw new Error(`seedPayment verify failed: ${await verify.text()}`);
    const verifyBody = await verify.json();
    return { bookingId: verifyBody.data.id as string, customerToken, customerId: userId };
  });
}

/**
 * The backend forces RAZORPAY_KEY_ID/SECRET empty for this test environment
 * (see tests/run-all.sh), so the order->verify flow always leaves a Payment
 * in status "mock" (see backend/src/modules/payment/payment.service.ts —
 * the `status: "paid"` transition only runs `if (paymentsLive)`). The admin
 * Settle/Refund buttons only render for status "paid"
 * (frontend/src/modules/admin/pages/Payments.tsx), and the backend
 * settle/refund endpoints hard-require status === "paid" too
 * (backend/src/modules/admin/admin.service.ts). So there is no legitimate
 * API path in this environment to reach a "paid" payment — we flip it
 * directly in the disposable local `nexclean-test` Mongo via mongosh, the
 * same way a real successful Razorpay payment would have landed. This is
 * test-data seeding on a throwaway DB, not an app-source change.
 */
/**
 * Locate the mongosh binary.
 *
 * Bare "mongosh" is not enough: Homebrew installs it to /opt/homebrew/bin, which
 * is on an interactive shell's PATH but frequently absent from the environment a
 * test runner inherits. When that happens execFileSync fails with a bare ENOENT
 * that reads like a broken test rather than a missing tool, so fall back to the
 * usual install locations and, failing that, say plainly what is missing.
 */
function resolveMongosh(): string {
  const candidates = [
    process.env.MONGOSH_PATH,
    "/opt/homebrew/bin/mongosh",
    "/usr/local/bin/mongosh",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  // Nothing found on disk — fall back to PATH resolution so a non-standard but
  // correctly-PATHed install still works.
  return "mongosh";
}

export function forcePaymentPaidByBookingId(bookingId: string): void {
  const script = `
    const res = db.payments.updateOne(
      { booking: ObjectId("${bookingId}") },
      { $set: { status: "paid", paymentId: "pay_test_e2e_forced", settlementStatus: "pending" } }
    );
    if (res.matchedCount !== 1) throw new Error("expected to match exactly 1 payment for booking ${bookingId}, matched " + res.matchedCount);
  `;
  execFileSync(resolveMongosh(), ["mongodb://127.0.0.1:27017/nexclean-test", "--quiet", "--eval", script], {
    // stdin must be "ignore", not part of a blanket "pipe". mongosh is itself a
    // Node CLI: handed a pipe on fd 0 that is closed immediately, it exits in a
    // way that leaves the *calling* Playwright worker with a non-zero exit code
    // — the run reports "N passed" and still fails the process. Detaching stdin
    // keeps the seeding side-effect from deciding the suite's exit status.
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export { DEMO_OTP };

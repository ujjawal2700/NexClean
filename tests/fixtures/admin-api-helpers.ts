import type { APIRequestContext } from "@playwright/test";
import { authHeader, DEMO_OTP, ADMIN_EMAIL, ADMIN_PASSWORD, SEED_AGENT_PHONE, SEED_PENDING_AGENT_PHONE, freshPhone } from "./api-client";

/**
 * playwright.config.ts's "api" project sets `baseURL: "http://localhost:4000/api"`
 * (no trailing slash), and every existing spec file calls `request.get("/foo")`
 * with a LEADING slash. Per the WHATWG URL spec (which is exactly what
 * Playwright's APIRequestContext uses internally: `new URL(givenURL, baseURL)`),
 * a leading "/" is a path-absolute reference that replaces the *entire* path of
 * the base URL — so `new URL("/health", "http://localhost:4000/api")` resolves
 * to "http://localhost:4000/health", silently dropping "/api", regardless of
 * whether baseURL has a trailing slash. Verified with `DEBUG=pw:api` and with
 * plain `node -e "new URL(...)"` — this is not baseURL-config-specific, it's
 * how relative URL resolution works, and it means every spec file that does
 * `request.get("/leads")` etc. is actually hitting `http://localhost:4000/leads`
 * (404) rather than `http://localhost:4000/api/leads`. This affects the WHOLE
 * suite (confirmed failing: health.spec.ts, auth.spec.ts too), not just the
 * new files added here — flagged in the final report. Since fixing it for real
 * means editing either playwright.config.ts or every existing spec file
 * (neither of which this task owns), the files in this task route every
 * request through `apiUrl()` below, which does plain string concatenation
 * (sidestepping URL-object resolution) so requests actually reach the API.
 */
const API_ROOT = process.env.API_BASE_URL ?? "http://localhost:4000/api";
export function apiUrl(path: string): string {
  return `${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
}

async function unwrap<T>(res: { ok: () => boolean; json: () => Promise<unknown> }, label: string): Promise<T> {
  const body = (await res.json()) as { success?: boolean; data?: T; message?: string };
  if (!res.ok() || body.success === false) {
    throw new Error(`${label} failed: ${body.message ?? JSON.stringify(body)}`);
  }
  return body.data as T;
}

/**
 * Same login flows as tests/fixtures/api-client.ts's loginByPhone/loginAsAdmin
 * etc, reimplemented here to route through apiUrl() — see the block comment
 * above. api-client.ts's versions are unusable in this environment (they call
 * the broken `request.post("/auth/...")` directly) and this task isn't
 * permitted to edit that shared file, so these are the working equivalents
 * for the admin/area-alert/lead/notification spec files.
 */
// verify-otp requires an existing account (NOT_REGISTERED otherwise) — see
// fixtures/api-client.ts's loginByPhone doc for the full explanation. This
// best-effort signup covers both fresh and already-registered phones; on an
// existing number it just 400s and is ignored.
export async function loginByPhoneApi(request: APIRequestContext, phone: string): Promise<{ token: string; userId: string }> {
  await request.post(apiUrl("/auth/customer/signup"), { data: { name: "Test Customer", phone } });
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

export async function loginAsAgentApi(request: APIRequestContext) {
  return loginByPhoneApi(request, SEED_AGENT_PHONE);
}

export async function loginAsPendingAgentApi(request: APIRequestContext) {
  return loginByPhoneApi(request, SEED_PENDING_AGENT_PHONE);
}

export async function loginAsAdminApi(request: APIRequestContext): Promise<{ token: string }> {
  const res = await request.post(apiUrl("/auth/admin-login"), { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  const data = await unwrap<{ token: string }>(res, "admin-login");
  return { token: data.token };
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
 * Full order → verify flow. The backend runs in mock mode here (no Razorpay
 * keys), so the resulting Payment stays at status "mock" (verifyAndBook only
 * flips status to "paid" when `paymentsLive` is true — see
 * backend/src/modules/payment/payment.service.ts) — it never reaches "paid"
 * through this public flow in this environment. Still useful: it's a real
 * Payment doc, discoverable via GET /admin/payments, that admin
 * refund/settle correctly reject with 400 (only "paid" payments qualify).
 */
export async function createMockPayment(
  request: APIRequestContext,
  customerToken: string,
): Promise<{ bookingId: string; orderId: string; amount: number }> {
  const pkgRes = await request.get(apiUrl("/catalog/packages"));
  const packageId = (await pkgRes.json()).data[0].id;
  const booking = bookingDraft(packageId);

  const orderRes = await request.post(apiUrl("/payments/order"), {
    headers: authHeader(customerToken),
    data: { booking },
  });
  if (!orderRes.ok()) throw new Error(`payments/order failed: ${await orderRes.text()}`);
  const order = (await orderRes.json()).data as { orderId: string; amount: number; mock: boolean };

  const verifyRes = await request.post(apiUrl("/payments/verify"), {
    headers: authHeader(customerToken),
    data: { booking, razorpay_order_id: order.orderId },
  });
  if (!verifyRes.ok()) throw new Error(`payments/verify failed: ${await verifyRes.text()}`);
  const created = (await verifyRes.json()).data as { id: string };

  return { bookingId: created.id, orderId: order.orderId, amount: order.amount };
}

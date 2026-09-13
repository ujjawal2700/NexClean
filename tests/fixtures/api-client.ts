import type { APIRequestContext } from "@playwright/test";

/** Demo OTP always accepted by the backend regardless of what was actually "sent" (see backend/src/config/env.ts DEMO_OTP). */
export const DEMO_OTP = process.env.DEMO_OTP ?? "123456";

/** One of the demo agents seeded on backend startup (see backend/src/config/seed.ts). Verified, online. */
export const SEED_AGENT_PHONE = "9000000001";

/** A second verified seeded agent, useful for multi-agent scenarios (dispatch races, assignment lists). */
export const SEED_AGENT_PHONE_2 = "9000000002";

/** Seeded agent with agentStatus:"pending" — lands on the KYC-gate "Application under review" screen. */
export const SEED_PENDING_AGENT_PHONE = "9000000004";

export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "superadmin@gmail.com";
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "password123";

/** Random 10-digit Indian-format phone so each test run creates a fresh customer. */
export function freshPhone(): string {
  return "9" + Math.floor(100000000 + Math.random() * 899999999).toString();
}

/**
 * A unique person-name for seeding test users.
 *
 * Names are validated as letters only (`/^[\p{L}\p{M}\s.'-]+$/u`), so the old
 * `Name ${Date.now()}` trick is rejected by the API. This encodes the same
 * timestamp entropy as letters instead of digits.
 */
export function uniqueName(prefix = "Test Customer"): string {
  let n = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  let suffix = "";
  while (n > 0) {
    suffix = String.fromCharCode(97 + (n % 26)) + suffix;
    n = Math.floor(n / 26);
  }
  return `${prefix} ${suffix}`;
}

async function unwrap<T>(res: { ok: () => boolean; json: () => Promise<unknown> }, label: string): Promise<T> {
  const body = (await res.json()) as { success?: boolean; data?: T; message?: string };
  if (!res.ok() || body.success === false) {
    throw new Error(`${label} failed: ${body.message ?? JSON.stringify(body)}`);
  }
  return body.data as T;
}

export const API_BASE = (process.env.API_BASE_URL ?? "http://127.0.0.1:4000/api").replace("localhost", "127.0.0.1");
export function apiUrl(path: string): string {
  return path.startsWith("http") ? path.replace("localhost", "127.0.0.1") : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Logs a phone in via the OTP flow (send + verify with the always-valid demo
 * code) and returns a bearer token.
 *
 * verify-otp no longer upserts an account on a fresh phone — it requires one
 * to already exist (auth.service.ts's verifyOtp: NOT_REGISTERED if
 * User.findOne comes back empty). Best-effort signup first covers both
 * callers that pass a genuinely fresh phone (this used to just work) and
 * ones that pass an already-registered phone (agent/admin fixtures, or a
 * phone an earlier step in the same test already signed up) — signup on an
 * existing number 400s and is ignored, it never touches that account's role.
 */
export async function loginByPhone(request: APIRequestContext, phone: string): Promise<{ token: string; userId: string }> {
  await request.post(apiUrl("/auth/customer/signup"), { data: { name: "Test Customer", phone } });
  await request.post(apiUrl("/auth/send-otp"), { data: { phone } });
  const res = await request.post(apiUrl("/auth/verify-otp"), { data: { phone, code: DEMO_OTP } });
  const data = await unwrap<{ token: string; user: { id: string } }>(res, "verify-otp");
  return { token: data.token, userId: data.user.id };
}

/** Logs in as a fresh, newly registered customer. */
export async function loginAsNewCustomer(request: APIRequestContext) {
  const phone = freshPhone();
  await request.post(apiUrl("/auth/customer/signup"), { data: { name: "Test Customer", phone } });
  return loginByPhone(request, phone);
}

/** Logs in as the seeded demo agent or specified agent. */
export async function loginAsAgent(request: APIRequestContext, phone: string = SEED_AGENT_PHONE) {
  return loginByPhone(request, phone);
}

/** Logs in as the seeded super admin. */
export async function loginAsAdmin(request: APIRequestContext): Promise<{ token: string }> {
  const res = await request.post(apiUrl("/auth/admin-login"), { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  const data = await unwrap<{ token: string }>(res, "admin-login");
  return { token: data.token };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

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

async function unwrap<T>(res: { ok: () => boolean; json: () => Promise<unknown> }, label: string): Promise<T> {
  const body = (await res.json()) as { success?: boolean; data?: T; message?: string };
  if (!res.ok() || body.success === false) {
    throw new Error(`${label} failed: ${body.message ?? JSON.stringify(body)}`);
  }
  return body.data as T;
}

const API_BASE = (process.env.API_BASE_URL ?? "http://127.0.0.1:4000/api").replace("localhost", "127.0.0.1");
function apiUrl(path: string): string {
  return path.startsWith("http") ? path.replace("localhost", "127.0.0.1") : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Logs a phone in via the OTP flow (send + verify with the always-valid demo code) and returns a bearer token. */
export async function loginByPhone(request: APIRequestContext, phone: string): Promise<{ token: string; userId: string }> {
  await request.post(apiUrl("/auth/send-otp"), { data: { phone } });
  const res = await request.post(apiUrl("/auth/verify-otp"), { data: { phone, code: DEMO_OTP } });
  const data = await unwrap<{ token: string; user: { id: string } }>(res, "verify-otp");
  return { token: data.token, userId: data.user.id };
}

/** Logs in as a fresh, never-before-seen customer. */
export async function loginAsNewCustomer(request: APIRequestContext) {
  return loginByPhone(request, freshPhone());
}

/** Logs in as the seeded demo agent. */
export async function loginAsAgent(request: APIRequestContext) {
  return loginByPhone(request, SEED_AGENT_PHONE);
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

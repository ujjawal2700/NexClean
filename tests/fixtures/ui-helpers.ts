import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_OTP, SEED_AGENT_PHONE, freshPhone } from "./api-client";
import { API_BASE_URL } from "../playwright.config";

/**
 * UI-driven login helpers shared across e2e/{customer,agent,admin} specs so
 * every spec exercises the exact same real login form instead of poking
 * localStorage directly (session shape: see sessionStore per role in
 * frontend/src/modules/{role}/store/sessionStore.ts).
 */

/**
 * Logs a fresh, never-before-seen phone number in through /app/login and
 * lands on /app.
 *
 * /app/login is now login-only: `send-login-otp` 404s with NOT_REGISTERED for
 * a phone that's never signed up (Login.tsx correctly shows a "please sign
 * up" modal rather than transitioning — that's the app behaving right, not a
 * bug). So a fresh phone needs an account before this form will do anything.
 * Registered here via the API rather than by driving /app/signup's own UI,
 * which is deliberately out of scope for the 12 other specs that call this
 * helper — they need a logged-in customer, not a signup-flow exercise, and
 * that already has its own dedicated, more thorough coverage in
 * signup.spec.ts (including a documented real app bug on the unserviced-city
 * branch this would otherwise run straight into on every test DB, since none
 * seed a city). Signup alone doesn't establish a session — no token, no
 * cookie — so it doesn't interfere with actually exercising the real login
 * form below, which is still the point of this helper.
 */
export async function loginCustomerUI(page: Page, phone: string = freshPhone()): Promise<string> {
  // Full absolute URL, not a relative path: page.request's baseURL here is
  // the FRONTEND origin (this is the customer-e2e project), and even a
  // leading-slash relative path against a baseURL with its own path segment
  // (API_BASE_URL is ".../api") drops that segment on merge — see
  // fixtures/customer-e2e-helpers.ts's module doc for the full explanation.
  await page.request.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone } });

  await page.goto("/app/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/app/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="phone"]').fill(phone);
  await page.getByRole("button", { name: "Send OTP" }).click();
  await expect(page.locator("h1")).toHaveText("Verify your number", { timeout: 15_000 });
  await page.locator('input[name="otp"]').fill(DEMO_OTP);
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await page.waitForURL(/\/app$/);
  return phone;
}

/** Logs the seeded verified demo agent (9000000001) in through /agent/login and lands on /agent. */
export async function loginAgentUI(page: Page, phone: string = SEED_AGENT_PHONE): Promise<void> {
  await page.goto("/agent/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/agent/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="phone"]').fill(phone);
  await page.getByRole("button", { name: "Send OTP" }).click();
  await expect(page.locator("h1")).toHaveText("Verify your number", { timeout: 15_000 });
  await page.locator('input[name="otp"]').fill(DEMO_OTP);
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await page.waitForURL(/\/agent$/);
}

/** Logs the seeded super admin in through /admin/login and lands on /admin. */
export async function loginAdminUI(
  page: Page,
  email: string = ADMIN_EMAIL,
  password: string = ADMIN_PASSWORD,
): Promise<void> {
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[name="email"]');
  await emailInput.fill("");
  await emailInput.fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
}

/** Registers a one-shot native `window.confirm`/`window.alert` auto-accept handler before a triggering click. */
export function autoAcceptNextDialog(page: Page): void {
  page.once("dialog", (dialog) => dialog.accept());
}

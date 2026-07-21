import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_OTP, SEED_AGENT_PHONE, freshPhone } from "./api-client";

/**
 * UI-driven login helpers shared across e2e/{customer,agent,admin} specs so
 * every spec exercises the exact same real login form instead of poking
 * localStorage directly (session shape: see sessionStore per role in
 * frontend/src/modules/{role}/store/sessionStore.ts).
 */

/** Logs a fresh, never-before-seen phone number in through /app/login and lands on /app. */
export async function loginCustomerUI(page: Page, phone: string = freshPhone()): Promise<string> {
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

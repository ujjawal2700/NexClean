import { test, expect } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

// The store apps (Flutter web view) can't use web push — iOS doesn't offer it
// in an app's web view — so they hand the page their native FCM token.
const NATIVE_TOKEN = "native-fcm-token-for-test-0123456789abcdef";

test.describe("Native app push token bridge", () => {
  test("signed in: registers the app's token with the server", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app");
    const registered = page.waitForRequest(
      (r) => r.url().includes("/notifications/register-token") && (r.postData() ?? "").includes(NATIVE_TOKEN),
    );
    const result = await page.evaluate(
      (t) => (window as unknown as { registerNativePushToken: (t: string) => Promise<boolean> }).registerNativePushToken(t),
      NATIVE_TOKEN,
    );
    await registered;
    expect(result).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem("nexclean-device-token"))).toBe(NATIVE_TOKEN);
  });

  test("signed out: keeps the token so signing in registers it", async ({ page }) => {
    await page.goto("/app/login");
    const result = await page.evaluate(
      (t) => (window as unknown as { registerNativePushToken: (t: string) => Promise<boolean> }).registerNativePushToken(t),
      NATIVE_TOKEN,
    );
    expect(result).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem("nexclean-device-token"))).toBe(NATIVE_TOKEN);

    // On sign-in the saved app token is what gets registered — not a placeholder.
    const registered = page.waitForRequest(
      (r) => r.url().includes("/notifications/register-token") && (r.postData() ?? "").includes(NATIVE_TOKEN),
      { timeout: 30_000 },
    );
    // loginCustomerUI clears storage first, so put the app's token back after it.
    await loginCustomerUI(page);
    await page.evaluate((t) => localStorage.setItem("nexclean-device-token", t), NATIVE_TOKEN);
    await page.goto("/app");
    await registered;
  });

  test("ignores an empty or junk token", async ({ page }) => {
    await page.goto("/app/login");
    const result = await page.evaluate(() =>
      (window as unknown as { registerNativePushToken: (t: unknown) => Promise<boolean> }).registerNativePushToken(""),
    );
    expect(result).toBe(false);
  });
});

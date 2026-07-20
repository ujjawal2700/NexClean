import { test, expect } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

test.describe("Notifications", () => {
  // KNOWN APP BUG (not a test bug, not specific to this page) — see
  // frontend/src/modules/customer/pages/Login.tsx:27. Same Rules-of-Hooks
  // violation pattern as the Signup.tsx bug documented in signup.spec.ts:
  // `if (token) return <Navigate to="/app" replace />;` sits between hook
  // calls (useSendOtp/useVerifyOtp before it; useState x4 + useRef after
  // it). Unlike Signup's crash, here `setToken` and `navigate` in verify()
  // run back-to-back with no intervening await, so React's concurrent
  // renderer usually recovers by re-running the render synchronously —
  // it doesn't visibly crash to the error boundary, but it DOES throw
  // "There was an error during concurrent rendering but React was able to
  // recover by instead synchronously rendering the entire root," which
  // surfaces as a page `error` event. Reproduced deterministically (every
  // run) on plain `loginCustomerUI` login — nothing to do with
  // /app/notifications itself, this is just the first test in the suite
  // that listens for page errors. This test intentionally asserts the
  // CORRECT behavior (no page errors) and is expected to fail (red) until
  // the app bug is fixed — do not weaken this assertion.
  test("loads without error and shows the empty state for a fresh customer", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await loginCustomerUI(page);
    await page.goto("/app/notifications");
    await expect(page.locator("h1")).toHaveText("Notifications");
    await expect(page.getByText("You're all caught up. No notifications yet.")).toBeVisible();

    expect(errors).toEqual([]);
  });
});

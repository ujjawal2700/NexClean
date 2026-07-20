import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin push notification campaigns", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/notifications");
    await expect(page.locator("h1")).toHaveText("Push Notifications");
  });

  test("compose and send a campaign end to end", async ({ page }) => {
    const title = `Weekend Sparkle Offer ${Date.now()}`;
    const body = "20% off this weekend only — book now!";

    await page.locator('input[name="title"]').fill(title);
    await page.locator("textarea").fill(body);
    // Pick an audience pill (defaults to "All customers" already selected).
    await page.getByRole("button", { name: /^Active customers/ }).click();

    const sendResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/campaigns") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Send campaign" }).click();
    const res = await sendResponse;
    expect(res.ok()).toBeTruthy();

    await expect(page.getByRole("button", { name: /Sent to \d/ })).toBeVisible();

    // Campaign appears in history.
    await expect(page.getByText(title)).toBeVisible();
  });
});

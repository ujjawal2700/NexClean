import { DEMO_OTP, SEED_AGENT_PHONE } from "../../fixtures/api-client";
import { loginAgentUI } from "../../fixtures/ui-helpers";
import { test, expect } from "../../fixtures/agent-e2e-helpers";

test.describe("Agent — one phone at a time", () => {
  test("logging in on a second phone asks first, then logs the first phone out live", async ({ page, browser }) => {
    // Phone A: signed in and sitting on the dashboard.
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await expect(page).toHaveURL(/\/agent$/);

    // Phone B: a separate browser is a separate install.
    const phoneB = await browser.newContext();
    const pageB = await phoneB.newPage();
    await pageB.goto("/agent/login");
    const cookieChoice = pageB.getByRole("button", { name: "Necessary only" });
    if (await cookieChoice.isVisible()) await cookieChoice.click();
    await pageB.locator('input[name="phone"]').fill(SEED_AGENT_PHONE);
    await pageB.getByRole("button", { name: "Send OTP" }).click();
    await pageB.locator('input[name="otp"]').fill(DEMO_OTP);
    await pageB.getByRole("button", { name: "Verify & continue" }).click();

    const ask = pageB.getByTestId("device-switch-dialog");
    await expect(ask).toBeVisible({ timeout: 15_000 });
    await expect(ask).toContainText("logged out from the other phone");

    await pageB.getByTestId("device-switch-confirm").click();
    await expect(pageB).toHaveURL(/\/agent$/, { timeout: 15_000 });

    // Phone A is told straight away, without a refresh, and OK sends it to login.
    const notice = page.getByTestId("booking-cancelled-dialog");
    await expect(notice).toContainText("logged in on another phone", { timeout: 15_000 });
    await notice.getByRole("button", { name: "OK" }).click();
    await expect(page).toHaveURL(/\/agent\/login/, { timeout: 15_000 });

    await phoneB.close();
  });

  test("cancelling keeps the other phone signed in", async ({ page, browser }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);

    const phoneB = await browser.newContext();
    const pageB = await phoneB.newPage();
    await pageB.goto("/agent/login");
    const cookieChoice = pageB.getByRole("button", { name: "Necessary only" });
    if (await cookieChoice.isVisible()) await cookieChoice.click();
    await pageB.locator('input[name="phone"]').fill(SEED_AGENT_PHONE);
    await pageB.getByRole("button", { name: "Send OTP" }).click();
    await pageB.locator('input[name="otp"]').fill(DEMO_OTP);
    await pageB.getByRole("button", { name: "Verify & continue" }).click();

    await expect(pageB.getByTestId("device-switch-dialog")).toBeVisible({ timeout: 15_000 });
    await pageB.getByRole("button", { name: "Cancel" }).click();
    await expect(pageB.getByText("still logged in on your other phone")).toBeVisible();
    await expect(pageB).toHaveURL(/\/agent\/login/);

    // Phone A is untouched.
    await page.reload();
    await expect(page).toHaveURL(/\/agent$/);
    await expect(page.getByTestId("booking-cancelled-dialog")).toHaveCount(0);

    await phoneB.close();
  });
});

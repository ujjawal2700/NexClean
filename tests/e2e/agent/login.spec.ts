import { DEMO_OTP, SEED_AGENT_PHONE, freshPhone, loginByPhone } from "../../fixtures/api-client";
import { loginAgentUI } from "../../fixtures/ui-helpers";
import { test, expect } from "../../fixtures/agent-e2e-helpers";

test.describe("Agent login", () => {
  test("happy path: seeded verified agent logs in and lands on the dashboard", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await expect(page).toHaveURL(/\/agent$/);
    await expect(page.locator("h1")).toContainText("👋");
  });

  test("phone step shows the expected copy and demo hint", async ({ page }) => {
    await page.goto("/agent/login");
    await expect(page.locator("h1")).toHaveText("Welcome, specialist");
    await expect(page.getByText("Agent Login")).toBeVisible();
    await expect(page.getByText("Demo agent: 9000000001")).toBeVisible();
  });

  test("rejects a malformed phone number client-side", async ({ page }) => {
    await page.goto("/agent/login");
    await page.locator('input[name="phone"]').fill("123");
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.getByText("Enter a valid 10-digit number")).toBeVisible();
    // Should not have advanced to the OTP step.
    await expect(page.locator("h1")).toHaveText("Welcome, specialist");
  });

  test("rejects a short OTP client-side", async ({ page }) => {
    await page.goto("/agent/login");
    await page.locator('input[name="phone"]').fill(SEED_AGENT_PHONE);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");
    await page.locator('input[name="otp"]').fill("123");
    await page.getByRole("button", { name: "Verify & continue" }).click();
    await expect(page.getByText("Enter the 6-digit code", { exact: true })).toBeVisible();
  });

  test("rejects an incorrect OTP from the server", async ({ page }) => {
    await page.goto("/agent/login");
    await page.locator('input[name="phone"]').fill(SEED_AGENT_PHONE);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");
    await page.locator('input[name="otp"]').fill("999999");
    await page.getByRole("button", { name: "Verify & continue" }).click();
    await expect(page.getByText("Incorrect code")).toBeVisible();
    // Still on the OTP step, not navigated away.
    await expect(page).toHaveURL(/\/agent\/login$/);
  });

  test("'Change number' link goes back to the phone step", async ({ page }) => {
    await page.goto("/agent/login");
    await page.locator('input[name="phone"]').fill(SEED_AGENT_PHONE);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");
    await page.getByText("Change number").click();
    await expect(page.locator("h1")).toHaveText("Welcome, specialist");
  });

  test("a phone that isn't registered as an agent is rejected after OTP verification", async ({ page, request }) => {
    const customerOnlyPhone = freshPhone();
    // Register this phone as a plain customer first (role defaults to "customer").
    await loginByPhone(request, customerOnlyPhone);

    await page.goto("/agent/login");
    await page.locator('input[name="phone"]').fill(customerOnlyPhone);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");
    await page.locator('input[name="otp"]').fill(DEMO_OTP);
    await page.getByRole("button", { name: "Verify & continue" }).click();
    await expect(page.getByText("This number isn't registered as an agent.")).toBeVisible();
    await expect(page).toHaveURL(/\/agent\/login$/);
  });

  test("'Apply to join' links to signup", async ({ page }) => {
    await page.goto("/agent/login");
    await page.getByRole("link", { name: "Apply to join" }).click();
    await expect(page).toHaveURL(/\/agent\/signup$/);
  });
});

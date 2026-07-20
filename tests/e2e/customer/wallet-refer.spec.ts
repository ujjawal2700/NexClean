import { test, expect } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

test.describe("Wallet", () => {
  test("renders a zero coin balance for a fresh customer without erroring", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/wallet");
    await expect(page.locator("h1")).toHaveText("Wallet");
    await expect(page.getByText("0 coins")).toBeVisible();
    await expect(page.getByText("No transactions yet")).toBeVisible();
  });

  test("Earn more coins button navigates to the refer page", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/wallet");
    await page.getByRole("button", { name: "Earn more coins" }).click();
    await page.waitForURL(/\/app\/profile\/refer$/);
  });
});

test.describe("Refer & Earn", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await loginCustomerUI(page);
    await page.goto("/app/profile/refer");
    await expect(page.locator("h1")).toHaveText("Refer & Earn");
  });

  test("renders a referral code and the Copy button flips to Copied", async ({ page }) => {
    const copyButton = page.getByRole("button", { name: /Copy/ });
    // The Copy button is only enabled once a real referralCode has loaded
    // (disabled={!referrals?.referralCode} in ReferEarn.tsx) — this also
    // proves the code rendered, not just the "—" placeholder.
    await expect(copyButton).toBeEnabled({ timeout: 10000 });
    await copyButton.click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  });

  test("shows an empty referrals state for a customer with no referrals", async ({ page }) => {
    await expect(page.getByText("No referrals yet")).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin referrals", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/referrals");
    await expect(page.locator("h1")).toHaveText("Referrals");
  });

  test("changing referral settings and saving persists across reload", async ({ page }) => {
    const newReferrerReward = String(50 + Math.floor(Math.random() * 100));

    // The settings inputs render read-only until "Edit settings" is clicked.
    await page.getByRole("button", { name: "Edit settings" }).click();

    const referrerInput = page.locator('input[name="referrerReward"]');
    await expect(referrerInput).toBeEnabled();
    await referrerInput.fill(newReferrerReward);

    const saveResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/referral-config") && res.request().method() === "PUT",
    );
    await page.getByRole("button", { name: /Save settings/ }).click();
    await saveResponse;

    await page.reload();
    await expect(page.locator("h1")).toHaveText("Referrals");
    await expect(page.locator('input[name="referrerReward"]')).toHaveValue(newReferrerReward);
  });

  test("referral logs table renders with search and status filter", async ({ page }) => {
    await expect(page.locator('input[name="referral-search"]')).toBeVisible();
    await expect(page.getByText("Status:")).toBeVisible();
    // Header pill and the stats card both render "Total Logs"/"Total
    // Invitations" text — assert the one that's always present regardless
    // of whether any logs exist yet.
    await expect(page.getByText("Total Invitations")).toBeVisible();
  });
});

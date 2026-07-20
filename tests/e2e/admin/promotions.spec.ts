import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin promotions", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/promotions");
    await expect(page.locator("h1")).toHaveText("Coupon & Promotions");
  });

  test("discount codes: create, toggle active, delete", async ({ page }) => {
    const code = `WELCOME${Date.now()}`.toUpperCase().slice(0, 20);

    await page.locator('input[name="code"]').fill(code.toLowerCase()); // component auto-uppercases
    await page.locator('select').first().selectOption("percent");
    await page.locator('input[name="value"]').fill("15");
    await page.locator('input[name="minOrderValue"]').fill("200");

    const createResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/discount-codes") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add discount code" }).click();
    await createResponse;

    await expect(page.getByText(code, { exact: true })).toBeVisible();

    // Toggle active.
    const rowLocator = page.getByText(code, { exact: true }).locator("xpath=../..");
    const toggleResponse = page.waitForResponse(
      (res) => /\/admin\/discount-codes\//.test(res.url()) && res.request().method() === "PATCH",
    );
    await rowLocator.getByRole("button", { name: "Active" }).click();
    await toggleResponse;
    await expect(rowLocator.getByRole("button", { name: "Inactive" })).toBeVisible();

    // Delete.
    const deleteResponse = page.waitForResponse(
      (res) => /\/admin\/discount-codes\//.test(res.url()) && res.request().method() === "DELETE",
    );
    await rowLocator.locator("button").last().click();
    await deleteResponse;
    await expect(page.getByText(code, { exact: true })).toHaveCount(0);
  });

  test("promotional banners: Add banner is disabled without an image URL", async ({ page }) => {
    await page.locator('input[name="bannerTitle"]').fill(`Test Banner ${Date.now()}`);
    // imageUrl left empty on purpose — Cloudinary upload isn't configured in this env.
    await expect(page.getByRole("button", { name: "Add banner" })).toBeDisabled();

    // Filling the (auto-populated-by-upload) image URL field manually should enable it.
    await page.locator('input[name="bannerImage"]').fill("https://example.com/banner.jpg");
    await expect(page.getByRole("button", { name: "Add banner" })).toBeEnabled();
  });
});

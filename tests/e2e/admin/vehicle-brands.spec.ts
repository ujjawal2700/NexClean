import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { cardByText } from "../../fixtures/admin-e2e-config-helpers";

test.describe("Admin vehicle brands", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/vehicle-brands");
    await expect(page.locator("h1")).toHaveText("Vehicle Brands");
  });

  test("create a brand, add a model, toggle it, delete both", async ({ page }) => {
    const brandName = `TestBrand${Date.now()}`;
    const modelName = `TestModel${Date.now()}`;

    // --- Create brand ---
    await page.locator('input[name="brandName"]').fill(brandName);
    const createBrandResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/vehicle-brands") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add brand" }).click();
    await createBrandResponse;

    const card = cardByText(page, brandName);
    await expect(card).toBeVisible();
    // Header row: the flex div directly wrapping the brand name <p> and the action buttons.
    const headerRow = card.getByText(brandName, { exact: true }).locator("xpath=..");

    // --- Add a model under the brand ---
    await card.locator('input[placeholder="e.g. Creta"]').fill(modelName);
    const createModelResponse = page.waitForResponse(
      (res) => /\/admin\/vehicle-brands\/.+\/models$/.test(res.url()) && res.request().method() === "POST",
    );
    // The chip only appears after the list refetches, so wait for that GET too —
    // asserting straight after the POST raced the refresh under load.
    const brandsRefetch = page.waitForResponse(
      (res) => /\/admin\/vehicle-brands(\?|$)/.test(res.url()) && res.request().method() === "GET",
      { timeout: 20_000 },
    );
    await card.getByRole("button", { name: "Add model" }).click();
    await createModelResponse;
    await brandsRefetch.catch(() => {});
    const modelChip = card.locator("span").filter({ hasText: modelName });
    await expect(modelChip).toBeVisible({ timeout: 15_000 });

    // --- Toggle the model's active bullet (•/○) ---
    const toggleModelResponse = page.waitForResponse(
      (res) => /\/admin\/vehicle-brands\/.+\/models\/.+/.test(res.url()) && res.request().method() === "PATCH",
    );
    await modelChip.getByRole("button", { name: `Deactivate ${modelName}` }).click();
    await toggleModelResponse;
    await expect(modelChip.getByRole("button", { name: `Activate ${modelName}` })).toBeVisible();

    // --- Delete the model ---
    const deleteModelResponse = page.waitForResponse(
      (res) => /\/admin\/vehicle-brands\/.+\/models\/.+/.test(res.url()) && res.request().method() === "DELETE",
    );
    await modelChip.getByRole("button", { name: `Remove ${modelName}` }).click();
    await deleteModelResponse;
    await expect(card.locator("span").filter({ hasText: modelName })).toHaveCount(0);

    // --- Toggle brand active/inactive ---
    const toggleBrandResponse = page.waitForResponse(
      (res) => /\/admin\/vehicle-brands\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "PATCH",
    );
    await headerRow.getByRole("button", { name: "Active" }).click();
    await toggleBrandResponse;
    await expect(headerRow.getByRole("button", { name: "Inactive" })).toBeVisible();

    // --- Delete the brand (no confirm dialog for brands) ---
    const deleteBrandResponse = page.waitForResponse(
      (res) => /\/admin\/vehicle-brands\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "DELETE",
    );
    await headerRow.locator("button").last().click();
    await deleteBrandResponse;
    await expect(cardByText(page, brandName)).toHaveCount(0);
  });
});

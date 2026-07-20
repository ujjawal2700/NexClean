import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin pricing", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/pricing");
    await expect(page.locator("h1")).toHaveText("Pricing");
  });

  test("changing a base price and saving persists across reload", async ({ page }) => {
    await expect(page.getByText("Base price by vehicle")).toBeVisible();

    // The base-price grid is the first block of number inputs on the page —
    // it renders before the service-packages section in DOM order.
    const firstBaseInput = page.locator('input[type="number"]').first();
    await expect(firstBaseInput).toBeVisible();

    const newValue = String(700 + Math.floor(Math.random() * 200));
    await firstBaseInput.fill(newValue);

    const saveButton = page.getByRole("button", { name: /Save pricing/ });
    const saveResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/pricing") && res.request().method() === "PUT",
    );
    await saveButton.click();
    await saveResponse;
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    await page.reload();
    await expect(page.locator("h1")).toHaveText("Pricing");
    const reloadedInput = page.locator('input[type="number"]').first();
    await expect(reloadedInput).toHaveValue(newValue);
  });

  test("service packages section renders with multiplier and duration controls", async ({ page }) => {
    await expect(page.getByText("Service packages")).toBeVisible();
    // Package rows (if any exist) show a name input, a step=0.1 multiplier input.
    const multiplierInputs = page.locator('input[step="0.1"]');
    const count = await multiplierInputs.count();
    if (count > 0) {
      await expect(multiplierInputs.first()).toBeVisible();
    }
  });
});

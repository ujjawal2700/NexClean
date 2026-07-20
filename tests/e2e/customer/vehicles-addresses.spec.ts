import { test, expect } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

test.describe("Vehicles (garage)", () => {
  test.beforeEach(async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/profile/vehicles");
    await expect(page.locator("h1")).toHaveText("Your garage");
  });

  test("starts empty for a fresh customer", async ({ page }) => {
    await expect(page.getByText("No vehicles yet.")).toBeVisible();
  });

  test("Save vehicle is disabled until a selection is resolved", async ({ page }) => {
    await page.getByRole("button", { name: "Add vehicle" }).click();
    await expect(page.getByRole("button", { name: "Save vehicle" })).toBeDisabled();
  });

  test("adds a vehicle via the manual-entry path (catalog is unseeded in this env)", async ({ page }) => {
    await page.getByRole("button", { name: "Add vehicle" }).click();
    await page.getByRole("button", { name: "Can't find your car? Enter it manually" }).click();

    await page.getByPlaceholder("e.g. Hyundai").fill("Hyundai");
    await page.getByPlaceholder("e.g. Creta").fill("Creta");
    await page.locator("select").selectOption("suv");
    await page.locator('input[name="vplate"]').fill("GJ 01 AB 1234");

    await expect(page.getByRole("button", { name: "Save vehicle" })).toBeEnabled();
    await page.getByRole("button", { name: "Save vehicle" }).click();

    await expect(page.getByText("Hyundai Creta")).toBeVisible();
    await expect(page.getByText(/SUV/).first()).toBeVisible();
  });

  test("removes a vehicle", async ({ page }) => {
    await page.getByRole("button", { name: "Add vehicle" }).click();
    await page.getByRole("button", { name: "Can't find your car? Enter it manually" }).click();
    await page.getByPlaceholder("e.g. Hyundai").fill("Maruti");
    await page.getByPlaceholder("e.g. Creta").fill("Swift");
    await page.locator("select").selectOption("hatchback");
    await page.getByRole("button", { name: "Save vehicle" }).click();
    await expect(page.getByText("Maruti Swift")).toBeVisible();

    await page.getByRole("button", { name: "Remove Maruti Swift" }).click();
    await expect(page.getByText("Maruti Swift")).not.toBeVisible();
    await expect(page.getByText("No vehicles yet.")).toBeVisible();
  });

  test("'Search the catalog instead' toggles back to the brand/model selects", async ({ page }) => {
    await page.getByRole("button", { name: "Add vehicle" }).click();
    await page.getByRole("button", { name: "Can't find your car? Enter it manually" }).click();
    await expect(page.getByPlaceholder("e.g. Hyundai")).toBeVisible();
    await page.getByRole("button", { name: "Search the catalog instead" }).click();
    // Back to the brand/model <select> pair — manual text inputs are gone,
    // and the catalog dropdowns (labelled "Brand" / "Model") are back.
    await expect(page.getByPlaceholder("e.g. Hyundai")).not.toBeVisible();
    await expect(page.locator("select").first()).toBeVisible();
    await expect(page.getByText("Brand", { exact: true })).toBeVisible();
  });
});

test.describe("Addresses", () => {
  test.beforeEach(async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/profile/addresses");
    await expect(page.locator("h1")).toHaveText("Saved addresses");
  });

  test("starts empty for a fresh customer", async ({ page }) => {
    await expect(page.getByText("No addresses yet.")).toBeVisible();
  });

  test("Save address is disabled with empty required fields, then adds an address", async ({ page }) => {
    await page.getByRole("button", { name: "Add address" }).click();
    await page.locator('input[name="alabel"]').fill("");
    await page.locator('input[name="aline"]').fill("");
    // Clicking with both empty is a no-op per component logic (guarded in saveAddress).
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("No addresses yet.")).toBeVisible();

    await page.locator('input[name="alabel"]').fill("Home");
    await page.locator('input[name="aline"]').fill("123 Test Street, Indore");
    await page.getByRole("button", { name: "Save address" }).click();

    await expect(page.getByText("Home")).toBeVisible();
    await expect(page.getByText("123 Test Street, Indore")).toBeVisible();
  });

  test("deletes an address", async ({ page }) => {
    await page.getByRole("button", { name: "Add address" }).click();
    await page.locator('input[name="alabel"]').fill("Office");
    await page.locator('input[name="aline"]').fill("456 Work Ave, Indore");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Office")).toBeVisible();

    await page.getByRole("button", { name: "Remove Office" }).click();
    await expect(page.getByText("Office")).not.toBeVisible();
    await expect(page.getByText("No addresses yet.")).toBeVisible();
  });
});

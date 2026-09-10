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
    await expect(page.getByText("No saved addresses yet")).toBeVisible();
  });

  test("Save address is disabled with empty required fields, then adds an address with map pin & structured fields", async ({ page }) => {
    await page.getByTestId("open-add-address").click();

    // Verify modal is open
    await expect(page.getByRole("dialog", { name: "Add Service Address" })).toBeVisible();

    const saveBtn = page.getByTestId("save-address-btn");
    await expect(saveBtn).toBeDisabled();

    // Fill in structured fields
    await page.getByTestId("input-house-no").fill("Flat 402, Tower B");
    await page.getByTestId("input-society").fill("Green Valley Heights, Sector 45");
    await page.getByTestId("input-landmark").fill("Near Central Club");
    await page.getByTestId("input-city").fill("Gurugram");
    await page.getByTestId("input-pincode").fill("122003");

    // Select Home label
    await page.getByTestId("label-preset-home").click();

    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Verify saved address card
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Home").first()).toBeVisible();
    await expect(page.getByText("Flat 402, Tower B, Green Valley Heights, Sector 45")).toBeVisible();
  });

  test("deletes an address", async ({ page }) => {
    await page.getByTestId("open-add-address").click();
    await page.getByTestId("input-house-no").fill("Suite 500");
    await page.getByTestId("input-society").fill("Tech Park 2");
    await page.getByTestId("label-preset-office").click();
    await page.getByTestId("save-address-btn").click();

    await expect(page.getByText("Office", { exact: true })).toBeVisible();

    // Delete it
    await page.getByRole("button", { name: "Remove Office" }).click();
    await expect(page.getByText("Office", { exact: true })).not.toBeVisible();
    await expect(page.getByText("No saved addresses yet")).toBeVisible();
  });
});

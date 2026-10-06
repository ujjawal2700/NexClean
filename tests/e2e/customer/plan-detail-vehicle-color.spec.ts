import { test, expect } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

test.describe("Plan detail page", () => {
  test("opens from the plans list, shows the plan, hides the tab bar, and Choose opens checkout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginCustomerUI(page);
    await page.goto("/app/plans");
    await expect(page.getByTestId("customer-mobile-nav")).toBeVisible();

    await page.getByRole("button", { name: "View Basic plan details" }).click();
    await expect(page).toHaveURL(/\/app\/plans\/basic$/);
    await expect(page.locator("h1")).toHaveText("Basic");
    await expect(page.getByText("What's included")).toBeVisible();
    await expect(page.getByText("Monthly price by vehicle")).toBeVisible();
    await expect(page.getByTestId("customer-mobile-nav")).toHaveCount(0);

    await page.getByRole("button", { name: "Choose Basic" }).click();
    await expect(page).toHaveURL(/\/app\/plans$/);
    await expect(page.getByRole("dialog", { name: "Confirm your plan" })).toBeVisible();
  });

  test("an unknown plan id shows a friendly not-available state", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/plans/does-not-exist");
    await expect(page.getByText("This plan isn't available")).toBeVisible();
    await page.getByRole("button", { name: "See all plans" }).click();
    await expect(page.locator("h1")).toHaveText("Subscription plans");
  });
});

test.describe("Vehicle colour", () => {
  test("garage: saves a vehicle with number and a picked colour", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/profile/vehicles");
    await page.getByRole("button", { name: "Add vehicle" }).click();
    await page.getByRole("button", { name: "Can't find your car? Enter it manually" }).click();
    await page.getByPlaceholder("e.g. Hyundai").fill("Hyundai");
    await page.getByPlaceholder("e.g. Creta").fill("Creta");
    await page.locator("select").selectOption("suv");
    await page.locator('input[name="vplate"]').fill("gj 01 ab 1234");
    await expect(page.locator('input[name="vplate"]')).toHaveValue("GJ 01 AB 1234");

    await page.getByRole("radio", { name: "Red" }).click();
    await expect(page.getByLabel("Colour name")).toHaveValue("Red");
    await page.getByLabel("Colour name").fill("Candy Red");

    await page.getByRole("button", { name: "Save vehicle" }).click();
    await expect(page.getByText("Hyundai Creta")).toBeVisible();
    await expect(page.getByText("Candy Red")).toBeVisible();
  });

  test("booking: vehicle number and colour are asked once a vehicle is chosen", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/book");
    await expect(page.getByText("Vehicle details")).toHaveCount(0);

    await page.getByRole("button", { name: "Can't find your car? Enter it manually" }).click();
    await page.getByPlaceholder("e.g. Hyundai").fill("Tata");
    await page.getByPlaceholder("e.g. Creta").fill("Nexon");
    await page.locator("select").selectOption("suv");

    await expect(page.getByText("Vehicle details")).toBeVisible();
    await page.locator('input[name="vehiclePlate"]').fill("mp 09 xy 4321");
    await expect(page.locator('input[name="vehiclePlate"]')).toHaveValue("MP 09 XY 4321");
    await page.getByRole("radio", { name: "Blue" }).click();
    await expect(page.getByRole("radio", { name: "Blue" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByLabel("Colour name")).toHaveValue("Blue");
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});

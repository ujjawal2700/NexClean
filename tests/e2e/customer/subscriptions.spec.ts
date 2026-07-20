import { test, expect } from "@playwright/test";
import { freshPhone } from "../../fixtures/api-client";
import { loginCustomerUI } from "../../fixtures/ui-helpers";
import { apiContext, mintTokenForPhone, seedVehicleAndAddress } from "../../fixtures/customer-e2e-helpers";

test.describe("Subscription plans", () => {
  test("catalog renders the seeded plans for a fresh customer with no active plan", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/plans");
    await expect(page.locator("h1")).toHaveText("Subscription plans");
    await expect(page.getByRole("heading", { name: "Basic" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Premium" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Elite" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose Basic" })).toBeVisible();
  });

  test("subscribing to a plan (mock payment) activates it and shows the wash dashboard", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/plans");

    await page.getByRole("button", { name: "Choose Basic" }).click();
    await expect(page.getByText("Confirm subscription")).toBeVisible();
    const payButton = page.getByRole("button", { name: /^Pay ₹/ });
    await payButton.click();

    // Mock mode goes straight through — lands on the Active Subscription dashboard.
    await expect(page.locator("h1")).toHaveText("Active Subscription", { timeout: 15000 });
    await expect(page.getByText("Basic")).toBeVisible();
    await expect(page.getByText(/washes used/)).toBeVisible();
  });

  test("cancel plan from the catalog view returns the customer to the unsubscribed state", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/plans");
    await page.getByRole("button", { name: "Choose Basic" }).click();
    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect(page.locator("h1")).toHaveText("Active Subscription", { timeout: 15000 });

    await page.getByRole("button", { name: "Upgrade / Cancel Plan" }).click();
    await expect(page.locator("h1")).toHaveText("Subscription plans");
    await page.getByRole("button", { name: "Cancel plan" }).click();

    await expect(page.getByRole("button", { name: "Choose Basic" })).toBeVisible({ timeout: 10000 });
  });

  test("schedule-wash modal: pick vehicle, address, date & slot, then schedule", async ({ page }) => {
    const phone = freshPhone();
    // Dedicated API-bound request context — the ambient `request` fixture in
    // this project is bound to the frontend baseURL, not the backend.
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    await seedVehicleAndAddress(api, token, {
      vehicleType: "hatchback",
      vehicleName: "Sub Test Car",
      addressLabel: "Home",
      addressLine: "123 Test Street, Indore",
    });
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto("/app/plans");
    await page.getByRole("button", { name: "Choose Basic" }).click();
    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect(page.locator("h1")).toHaveText("Active Subscription", { timeout: 15000 });

    await page.getByRole("button", { name: "Schedule now" }).click();
    await expect(page.getByText("Schedule Subscription Wash")).toBeVisible();

    // Only one vehicle/address is seeded, so the vehicle + address selects
    // are already pre-populated with them via handleOpenSchedule's defaults
    // (me.vehicles[0] / me.addresses[0]) — just verify and proceed.
    await expect(page.locator("select").nth(0).locator("option:checked")).toContainText("Sub Test Car");
    await expect(page.locator("select").nth(1).locator("option:checked")).toContainText("Home");

    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).first().click();
    await page.getByRole("button", { name: "08:00 AM" }).click();

    await page.getByRole("button", { name: "Schedule Wash", exact: true }).click();
    await expect(page.getByText("Schedule Subscription Wash")).not.toBeVisible({ timeout: 10000 });
    // "Sub Test Car" now appears both in the "Next Wash" summary card and the
    // schedule grid card — just assert at least one instance rendered.
    await expect(page.getByText("Sub Test Car").first()).toBeVisible();
  });

  test("schedule-wash modal shows a validation error if submitted incomplete", async ({ page }) => {
    const phone = freshPhone();
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    await seedVehicleAndAddress(api, token, {
      vehicleType: "hatchback",
      vehicleName: "Incomplete Test Car",
      addressLabel: "Home",
      addressLine: "123 Test Street, Indore",
    });
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto("/app/plans");
    await page.getByRole("button", { name: "Choose Basic" }).click();
    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect(page.locator("h1")).toHaveText("Active Subscription", { timeout: 15000 });

    await page.getByRole("button", { name: "Schedule now" }).click();
    await expect(page.getByText("Schedule Subscription Wash")).toBeVisible();
    // No date/slot picked — submit immediately.
    await page.getByRole("button", { name: "Schedule Wash", exact: true }).click();
    await expect(page.getByText("Please select a vehicle, address, date, and slot.")).toBeVisible();
  });
});

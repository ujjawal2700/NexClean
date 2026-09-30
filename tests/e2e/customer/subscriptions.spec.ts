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
    const sheet = page.getByRole("dialog", { name: "Schedule a wash" });
    await expect(sheet).toBeVisible();

    // Only one vehicle/address is seeded, so the new radio-card controls are
    // already preselected by handleOpenSchedule's defaults.
    await expect(sheet.getByRole("radio", { name: /Sub Test Car/ })).toHaveAttribute("aria-checked", "true");
    await expect(sheet.getByRole("radio", { name: /Home/ })).toHaveAttribute("aria-checked", "true");

    await sheet.getByRole("button", { name: /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/ }).first().click();
    await sheet.getByRole("button", { name: "08:00 AM" }).click();

    await sheet.getByRole("button", { name: "Schedule wash", exact: true }).click();
    await expect(sheet).not.toBeVisible({ timeout: 10000 });
    // "Sub Test Car" now appears both in the "Next Wash" summary card and the
    // schedule grid card — just assert at least one instance rendered.
    await expect(page.getByText("Sub Test Car").first()).toBeVisible();
  });

  test("schedule-wash modal keeps submission disabled until date and time are selected", async ({ page }) => {
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
    const sheet = page.getByRole("dialog", { name: "Schedule a wash" });
    await expect(sheet).toBeVisible();
    // Vehicle/address have defaults, but no date/slot has been picked yet.
    // The redesigned sheet prevents an invalid submit instead of displaying a
    // validation error after the click.
    await expect(sheet.getByRole("button", { name: "Schedule wash", exact: true })).toBeDisabled();
    await expect(sheet.getByText("Choose a date and time")).toBeVisible();
  });
});

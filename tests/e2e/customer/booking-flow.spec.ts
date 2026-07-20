import { test, expect } from "@playwright/test";
import { freshPhone } from "../../fixtures/api-client";
import { loginCustomerUI } from "../../fixtures/ui-helpers";
import { apiContext, mintTokenForPhone, seedVehicleAndAddress } from "../../fixtures/customer-e2e-helpers";

test.describe("Booking flow", () => {
  test("full 5-step happy path: vehicle -> package -> schedule -> address -> pay -> confirmation", async ({ page }) => {
    const phone = freshPhone();
    // Seed a vehicle + address via API BEFORE the UI login so the login's
    // verify-otp response (which the app caches as the `me` query) already
    // reflects them — avoids a stale-cache race with a freshly logged-in UI
    // session. Uses a dedicated API-bound request context — the ambient
    // `request` fixture in this project is bound to the frontend baseURL.
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    await seedVehicleAndAddress(api, token, {
      vehicleType: "hatchback",
      vehicleName: "Test Hatchback",
      addressLabel: "Home",
      addressLine: "123 Test Street, Indore",
    });
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto("/app/book");
    await expect(page.locator("h1")).toHaveText("Book a cleaning");

    // Step 0: vehicle — pick the saved one.
    await page.getByRole("button", { name: /Test Hatchback/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 1: package.
    await expect(page.getByText("Choose a package")).toBeVisible();
    await page.getByRole("button", { name: /Express Wash/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: date + slot.
    await expect(page.getByText("Pick a date & time")).toBeVisible();
    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).first().click();
    // Real TIME_SLOTS (frontend/src/modules/customer/data/catalog.ts) — "10:00 AM" isn't one of them.
    await page.getByRole("button", { name: "09:30 AM" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: address — pick the saved one.
    await expect(page.getByText("Where should we come?")).toBeVisible();
    await page.getByRole("button", { name: /Home/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: payment.
    await expect(page.getByText("Choose how you'd like to pay.")).toBeVisible();

    // Invalid discount code shows an inline error next to the input.
    await page.locator('input[name="discountCode"]').fill("NOTAREALCODE");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Invalid discount code")).toBeVisible({ timeout: 10000 });

    // Pay — mock mode (no Razorpay keys configured) means this should go
    // straight to the confirmation screen without any checkout iframe.
    const payButton = page.getByRole("button", { name: /^Pay ₹/ });
    await payButton.click();

    await expect(page.locator("h1")).toHaveText("Booking confirmed!", { timeout: 15000 });
    await expect(page.getByText(/Booking ID/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View my bookings" })).toBeVisible();

    // Follow through to the bookings list and confirm it shows up.
    await page.getByRole("link", { name: "View my bookings" }).click();
    await page.waitForURL(/\/app\/bookings$/);
    await expect(page.getByText("Test Hatchback")).toBeVisible();
  });

  test("Continue is disabled on the vehicle step until a vehicle is chosen", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/book");
    await expect(page.locator("h1")).toHaveText("Book a cleaning");
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("manual vehicle entry works inline in the booking flow (no saved vehicles)", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/book");
    await page.getByRole("button", { name: "Can't find your car? Enter it manually" }).click();
    await page.getByPlaceholder("e.g. Hyundai").fill("Tata");
    await page.getByPlaceholder("e.g. Creta").fill("Nexon");
    await page.locator("select").selectOption("suv");
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("Continue is disabled on the address step with no saved addresses, and the add-address link works", async ({ page }) => {
    // Fresh customer, no seeded vehicles/addresses.
    await loginCustomerUI(page);
    await page.goto("/app/book");
    // Pick a vehicle manually and a package to reach the address step.
    await page.getByRole("button", { name: "Can't find your car? Enter it manually" }).click();
    await page.getByPlaceholder("e.g. Hyundai").fill("Honda");
    await page.getByPlaceholder("e.g. Creta").fill("City");
    await page.locator("select").selectOption("sedan");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Express Wash/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).first().click();
    await page.getByRole("button", { name: "08:00 AM" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Where should we come?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await expect(page.getByRole("link", { name: /Add a new address/ })).toBeVisible();
  });
});

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
    // Pick TOMORROW, not today, and take whatever slot is offered. The app
    // correctly hides slots that have already passed for the current day, so
    // pinning a specific time on today's date made this pass in the morning
    // and fail every afternoon.
    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).nth(1).click();
    await page.getByRole("button", { name: /^\d{2}:\d{2} (AM|PM)$/ }).first().click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: address — pick the saved one.
    await expect(page.getByText("Where should we come?")).toBeVisible();
    await page.getByRole("button", { name: /Home/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: payment. There is no payment-method picker — NexClean collects
    // cash on completion — so the step is the discount code plus the total.
    await expect(page.getByText("Review your total and confirm the booking.")).toBeVisible();
    await expect(page.getByText("Amount to pay")).toBeVisible();

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
    // Tracking is the primary action now: dispatch is already offering the job
    // to cleaners while this receipt is on screen, so the confirmation hands
    // straight off to the live search rather than dead-ending on the dashboard.
    await expect(page.getByRole("link", { name: "Track my cleaner" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View my bookings" })).toBeVisible();

    // …and it forwards there on its own if the customer does nothing.
    await page.waitForURL(/\/app\/track\/[a-f0-9]{24}$/, { timeout: 15000 });
    await expect(
      page.getByText(/Finding the nearest cleaner|Priority assignment in progress|on the way/),
    ).toBeVisible({ timeout: 15000 });

    // The booking is real and shows up in the list.
    await page.goto("/app/bookings");
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

  test("Continue is disabled on the address step with no saved addresses, and adding an address works via modal", async ({ page }) => {
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
    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).nth(1).click();
    await page.getByRole("button", { name: /^\d{2}:\d{2} (AM|PM)$/ }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Where should we come?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

    // Verify empty addresses card & open modal
    await expect(page.getByText("No addresses added yet")).toBeVisible();
    await page.getByTestId("add-first-address-btn").click();

    await expect(page.getByRole("dialog", { name: "Add Service Address" })).toBeVisible();
    await page.getByTestId("input-house-no").fill("Flat 101");
    await page.getByTestId("input-society").fill("Sunrise Heights");
    await page.getByTestId("save-address-btn").click();

    // Modal closes and address is auto-selected, enabling Continue
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Sunrise Heights")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});

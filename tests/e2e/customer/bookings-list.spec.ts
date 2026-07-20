import { test, expect } from "@playwright/test";
import { freshPhone } from "../../fixtures/api-client";
import { loginCustomerUI } from "../../fixtures/ui-helpers";
import { apiContext, createBooking, firstPackageId, mintTokenForPhone } from "../../fixtures/customer-e2e-helpers";

function validBookingPayload(packageId: string) {
  return {
    vehicleType: "hatchback",
    vehicleName: "Listed Car",
    packageId,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    slot: "09:30 AM",
    addressLabel: "Home",
    addressLine: "123 Test Street",
  };
}

test.describe("Bookings list", () => {
  test("shows an empty state with a link to book, for a fresh customer", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/bookings");
    await expect(page.locator("h1")).toHaveText("My bookings");
    await expect(page.getByText("No bookings here yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Book a cleaning" })).toBeVisible();
  });

  test("filter tabs change the visible list, and Cancel updates a booking's status", async ({ page }) => {
    const phone = freshPhone();
    // Dedicated API-bound request context — the ambient `request` fixture in
    // this project is bound to the frontend baseURL, not the backend.
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    const packageId = await firstPackageId(api);
    const created = await createBooking(api, token, validBookingPayload(packageId));
    expect(created.data.id).toBeTruthy();
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto("/app/bookings");
    await expect(page.locator("h1")).toHaveText("My bookings");
    await expect(page.getByText("Listed Car")).toBeVisible();

    // Filter tabs.
    await page.getByRole("button", { name: "Completed" }).click();
    await expect(page.getByText("No bookings here yet.")).toBeVisible();
    await page.getByRole("button", { name: "Cancelled" }).click();
    await expect(page.getByText("No bookings here yet.")).toBeVisible();
    await page.getByRole("button", { name: "Upcoming" }).click();
    await expect(page.getByText("Listed Car")).toBeVisible();
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByText("Listed Car")).toBeVisible();

    // Cancel the upcoming booking. Exact match — the "Cancelled" filter tab
    // button's accessible name otherwise substring-matches "Cancel" too.
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("cancelled")).toBeVisible({ timeout: 10000 });

    // Now shows up under the Cancelled filter, not Upcoming.
    await page.getByRole("button", { name: "Upcoming" }).click();
    await expect(page.getByText("No bookings here yet.")).toBeVisible();
    await page.getByRole("button", { name: "Cancelled" }).click();
    await expect(page.getByText("Listed Car")).toBeVisible();
  });

  test("New booking link navigates to the booking flow", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/bookings");
    await page.getByRole("link", { name: "New booking" }).click();
    await page.waitForURL(/\/app\/book$/);
  });
});

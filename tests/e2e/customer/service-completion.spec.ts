import { test, expect } from "@playwright/test";
import { API_BASE_URL } from "../../playwright.config";

test("an ongoing service completion shows a blocking rating prompt and Maybe later returns home", async ({ page }) => {
  const baseBooking = {
    id: "booking-live-1",
    user: "customer-1",
    vehicleType: "hatchback",
    vehicleName: "Test Car",
    packageId: "express",
    packageName: "Express Wash",
    date: "2026-10-01T10:00:00.000Z",
    slot: "11:00 AM",
    addressLabel: "Home",
    addressLine: "123 Test Street",
    society: "Test Society",
    price: 299,
    status: "upcoming",
    jobStatus: "in_progress",
    dispatchStatus: "assigned",
    agentName: "Test Cleaner",
  };
  let bookings = [baseBooking];

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = null;
    if (path.endsWith("/auth/me")) {
      data = {
        id: "customer-1",
        name: "Completion Customer",
        phone: "9999999999",
        role: "customer",
        vehicles: [],
        addresses: [],
        activePlan: null,
      };
    } else if (path.endsWith("/bookings")) data = bookings;
    else if (path.endsWith("/notifications")) data = [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "nexclean-session",
      JSON.stringify({ state: { authenticated: true, guest: false }, version: 0 }),
    );
    localStorage.setItem(
      "nexclean-cookie-consent",
      JSON.stringify({ version: 1, necessary: true, functional: false, updatedAt: new Date().toISOString() }),
    );
  });

  await page.goto("/app/bookings");
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();

  bookings = [{ ...baseBooking, status: "completed", jobStatus: "completed" }];

  const dialog = page.getByTestId("service-completed-dialog");
  await expect(dialog).toBeVisible({ timeout: 8_000 });
  await expect(dialog.getByRole("heading", { name: "Your service is completed" })).toBeVisible();
  // It asks the customer to rate the cleaner by name.
  await expect(dialog).toContainText("Please rate Test");
  await expect(dialog.getByRole("button", { name: "Rate 5 stars" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Rate now" })).toBeVisible();
  await dialog.getByRole("button", { name: "Maybe later" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(dialog).toHaveCount(0);
});

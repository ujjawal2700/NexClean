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
    // Cancelling now asks first, and says what happens to any refund.
    await expect(page.getByRole("heading", { name: "Cancel this booking?" })).toBeVisible();
    await page.getByTestId("confirm-cancel-booking").click();
    // The live cancellation popup confirms it, and OK goes to the dashboard.
    const cancelled = page.getByTestId("booking-cancelled-dialog");
    await expect(cancelled).toBeVisible({ timeout: 10000 });
    await cancelled.getByRole("button", { name: "OK" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/app/bookings");

    // Now shows up under the Cancelled filter, not Upcoming.
    await page.getByRole("button", { name: "Upcoming" }).click();
    await expect(page.getByText("No bookings here yet.")).toBeVisible();
    await page.getByRole("button", { name: "Cancelled" }).click();
    await expect(page.getByText("Listed Car")).toBeVisible();
  });

  test("loads 10 bookings at first and the rest as you scroll, with counts on the tabs", async ({ page }) => {
    test.setTimeout(90_000);
    const phone = freshPhone();
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    const packageId = await firstPackageId(api);
    for (let i = 0; i < 12; i++) {
      await createBooking(api, token, { ...validBookingPayload(packageId), vehicleName: `Paged Car ${i}` });
    }
    await api.dispose();

    // Watch the requests the page makes.
    const pageRequests: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.endsWith("/bookings") && u.searchParams.has("page")) pageRequests.push(u.search);
    });

    await loginCustomerUI(page, phone);
    await page.goto("/app/bookings");
    await expect(page.getByTestId("count-all")).toHaveText("12");
    await expect(page.getByText("Paged Car 11")).toBeVisible();
    // First page only: the oldest two aren't loaded yet.
    await expect(page.getByText(/^Paged Car \d+$/)).toHaveCount(10);
    expect(pageRequests.some((q) => q.includes("page=1"))).toBe(true);
    expect(pageRequests.some((q) => q.includes("page=2"))).toBe(false);

    // Scrolling to the end fetches page 2.
    await page.getByTestId("load-more-bookings").scrollIntoViewIfNeeded();
    await expect(page.getByText(/^Paged Car \d+$/)).toHaveCount(12);
    await expect(page.getByText("Paged Car 0", { exact: true })).toBeVisible();
    await expect(page.getByTestId("bookings-end")).toContainText("12 bookings");
    expect(pageRequests.some((q) => q.includes("page=2"))).toBe(true);
  });

  test("New booking link navigates to the booking flow", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/bookings");
    await page.getByRole("link", { name: "New booking" }).click();
    await page.waitForURL(/\/app\/book$/);
  });
});

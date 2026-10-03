import { test, expect } from "@playwright/test";
import { freshPhone } from "../../fixtures/api-client";
import { loginCustomerUI } from "../../fixtures/ui-helpers";
import { apiContext, createBooking, firstPackageId, mintTokenForPhone } from "../../fixtures/customer-e2e-helpers";

/**
 * A scheduled booking can be changed or cancelled from wherever the customer
 * finds it — the tracking screen a new booking opens on and the dashboard —
 * not only from the bookings list.
 */

async function scheduledBooking(vehicleName: string) {
  const phone = freshPhone();
  const api = await apiContext();
  const { token } = await mintTokenForPhone(api, phone);
  const packageId = await firstPackageId(api);
  const created = await createBooking(api, token, {
    vehicleType: "hatchback",
    vehicleName,
    packageId,
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    slot: "09:30 AM",
    addressLabel: "Home",
    addressLine: "123 Test Street",
  });
  await api.dispose();
  return { phone, id: created.data.id as string };
}

test.describe("Managing a scheduled booking", () => {
  test("the tracking screen offers Reschedule and Cancel", async ({ page }) => {
    const { phone, id } = await scheduledBooking("Track Manage Car");
    await loginCustomerUI(page, phone);
    await page.goto(`/app/track/${id}`);

    await page.getByTestId("manage-reschedule").click();
    await expect(page.getByRole("heading", { name: "Move this booking" })).toBeVisible();
    await expect(page.getByText("Track Manage Car").first()).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByTestId("manage-cancel").click();
    await expect(page.getByRole("heading", { name: "Cancel this booking?" })).toBeVisible();
    await page.getByTestId("confirm-cancel-booking").click();
    await expect(page.getByTestId("booking-cancelled-dialog")).toBeVisible({ timeout: 10_000 });
  });

  test("the dashboard's upcoming card offers Reschedule and Cancel", async ({ page }) => {
    const { phone } = await scheduledBooking("Dashboard Manage Car");
    await loginCustomerUI(page, phone);
    await page.goto("/app");
    await expect(page.getByText("Dashboard Manage Car").first()).toBeVisible();

    await page.getByTestId("manage-reschedule").click();
    await expect(page.getByRole("heading", { name: "Move this booking" })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByTestId("manage-cancel").click();
    await page.getByTestId("confirm-cancel-booking").click();
    await expect(page.getByTestId("booking-cancelled-dialog")).toBeVisible({ timeout: 10_000 });
  });
});

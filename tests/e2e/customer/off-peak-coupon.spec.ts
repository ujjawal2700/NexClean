import { test, expect, type APIRequestContext } from "@playwright/test";
import { freshPhone, authHeader, ADMIN_EMAIL, ADMIN_PASSWORD } from "../../fixtures/api-client";
import { loginCustomerUI } from "../../fixtures/ui-helpers";
import { apiContext, mintTokenForPhone, seedVehicleAndAddress } from "../../fixtures/customer-e2e-helpers";
import { API_BASE_URL } from "../../playwright.config";

/**
 * End-to-end proof that an off-peak-only coupon behaves correctly in the real
 * customer UI: accepted on a quiet (off-peak) slot with the discount reaching
 * the confirmation screen, and refused on a busy (peak) slot with an
 * explanatory message. The API suite covers the rules; this covers the wiring —
 * that the booking screen actually sends the chosen slot along with the code.
 */

const IST = "Asia/Kolkata";
/** Inside the configured off-peak window below, so discounts apply. */
const DISCOUNTED_SLOT = "11:00 AM";
/** Outside every window — a peak slot, sold at full price. */
const FULL_PRICE_SLOT = "05:00 PM";

// apiContext() is deliberately created with NO baseURL, so every backend call
// here uses a full absolute URL — see the module doc in customer-e2e-helpers.ts.
async function adminToken(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${API_BASE_URL}/auth/admin-login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) throw new Error(`admin-login failed: ${await res.text()}`);
  return (await res.json()).data.token;
}

test.describe("Customer — off-peak coupon", () => {
  /**
   * The same 10:00–12:00 window on *every* weekday.
   *
   * Deliberately not "tomorrow's weekday": `upcomingDates()` drops today once no
   * slot is still 60+ minutes away, so the date chips shift by one partway
   * through the afternoon and the chip at index 1 stops being tomorrow. Pinning
   * a single weekday made this pass in the morning and fail after ~17:30 — the
   * same afternoon trap booking-flow.spec.ts documents. Covering all seven days
   * costs nothing here: these tests are about a slot falling inside vs outside a
   * window, not about which day it lands on.
   */
  const allDayWindows = Array.from({ length: 7 }, (_, day) => ({
    day,
    start: "10:00",
    end: "12:00",
    label: "E2E window",
  }));

  let code = "";

  test.beforeEach(async () => {
    const api = await apiContext();
    const token = await adminToken(api);

    await api.put(`${API_BASE_URL}/admin/off-peak-hours`, {
      headers: authHeader(token),
      data: { timezone: IST, active: true, windows: allDayWindows },
    });

    code = `E2EPEAK${Date.now()}`;
    const res = await api.post(`${API_BASE_URL}/admin/discount-codes`, {
      headers: authHeader(token),
      data: { code, type: "flat", value: 50, offPeakOnly: true },
    });
    expect(res.status()).toBe(201);
    await api.dispose();
  });

  test.afterAll(async () => {
    const api = await apiContext();
    const token = await adminToken(api);
    await api.put(`${API_BASE_URL}/admin/off-peak-hours`, {
      headers: authHeader(token),
      data: { timezone: IST, active: true, windows: [] },
    });
    await api.dispose();
  });

  /** Drives the flow up to the payment step on the given slot. */
  async function bookUpToPayment(page: import("@playwright/test").Page, slot: string) {
    const phone = freshPhone();
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    await seedVehicleAndAddress(api, token, {
      vehicleType: "hatchback",
      vehicleName: "Off-Peak Test Car",
      addressLabel: "Home",
      addressLine: "123 Quiet Street, Indore",
    });
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto("/app/book");
    await expect(page.locator("h1")).toHaveText("Book a cleaning");

    await page.getByRole("button", { name: /Off-Peak Test Car/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Choose a package")).toBeVisible();
    await page.getByRole("button", { name: /Express Wash/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Tomorrow is the second date chip; every weekday carries the same window.
    await expect(page.getByText("Pick a date & time")).toBeVisible();
    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).nth(1).click();
    await page.getByRole("button", { name: new RegExp(`^${slot}$`) }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Where should we come?")).toBeVisible();
    await page.getByRole("button", { name: /Home/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Review your total and confirm the booking.")).toBeVisible();
  }

  test("the schedule step flags which slots are discounted", async ({ page }) => {
    const phone = freshPhone();
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    await seedVehicleAndAddress(api, token, {
      vehicleType: "hatchback",
      vehicleName: "Off-Peak Test Car",
      addressLabel: "Home",
      addressLine: "123 Quiet Street, Indore",
    });
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto("/app/book");
    await page.getByRole("button", { name: /Off-Peak Test Car/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Express Wash/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Pick a date & time")).toBeVisible();
    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).nth(1).click();

    // The configured window is surfaced, and the discounted slot carries its marker
    // without that marker leaking into the button's accessible name.
    await expect(page.getByText("Cheaper 10:00–12:00")).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^${DISCOUNTED_SLOT}$`) })).toHaveAttribute(
      "data-off-peak",
      "true",
    );
    await expect(
      page.getByRole("button", { name: new RegExp(`^${FULL_PRICE_SLOT}$`) }),
    ).not.toHaveAttribute("data-off-peak", "true");
  });

  test("refuses the coupon on a peak slot, naming the discounted window", async ({ page }) => {
    await bookUpToPayment(page, FULL_PRICE_SLOT);

    await page.locator('input[name="discountCode"]').fill(code);
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByText(/only works on off-peak slots/i)).toBeVisible({ timeout: 10000 });
    // No discount line should have appeared in the totals.
    await expect(page.getByText(`Discount (${code})`)).toHaveCount(0);
  });

  test("accepts the coupon on an off-peak slot and carries it to confirmation", async ({ page }) => {
    await bookUpToPayment(page, DISCOUNTED_SLOT);

    await page.locator('input[name="discountCode"]').fill(code);
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByText(`${code} applied`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("You saved ₹50")).toBeVisible();

    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect(page.locator("h1")).toHaveText("Booking confirmed!", { timeout: 15000 });
    await expect(page.getByText(`Discount (${code})`)).toBeVisible();
  });

  test("drops the coupon when the customer goes back and picks a peak slot", async ({ page }) => {
    await bookUpToPayment(page, DISCOUNTED_SLOT);

    await page.locator('input[name="discountCode"]').fill(code);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(`${code} applied`)).toBeVisible({ timeout: 10000 });

    // Back to the schedule step and switch to a slot the coupon can't cover.
    // Two controls are named "Back": the header's history arrow and the step
    // navigator. `.last()` is the step navigator, which is the one that walks
    // the wizard backwards rather than leaving the flow entirely.
    const stepBack = page.getByRole("button", { name: "Back" }).last();
    await stepBack.click();
    await stepBack.click();
    await expect(page.getByText("Pick a date & time")).toBeVisible();
    await page.getByRole("button", { name: new RegExp(`^${FULL_PRICE_SLOT}$`) }).click();

    // The stale discount must be cleared rather than surviving to payment.
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Review your total and confirm the booking.")).toBeVisible();
    await expect(page.getByText(`${code} applied`)).toHaveCount(0);

    // And the booking still completes, at the undiscounted price.
    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect(page.locator("h1")).toHaveText("Booking confirmed!", { timeout: 15000 });
    await expect(page.getByText(`Discount (${code})`)).toHaveCount(0);
  });
});

import { test, expect, type APIRequestContext } from "@playwright/test";
import { freshPhone, authHeader, ADMIN_EMAIL, ADMIN_PASSWORD } from "../../fixtures/api-client";
import { loginCustomerUI } from "../../fixtures/ui-helpers";
import { apiContext, mintTokenForPhone, seedVehicleAndAddress } from "../../fixtures/customer-e2e-helpers";
import { API_BASE_URL } from "../../playwright.config";

/**
 * End-to-end proof that a peak-hours-only coupon behaves correctly in the real
 * customer UI: it is refused on an off-peak slot with an explanatory message,
 * and accepted on a peak slot, with the discount reaching the confirmation
 * screen. The API suite covers the rules; this covers the wiring — that the
 * booking screen actually sends the chosen slot along with the code.
 */

const IST = "Asia/Kolkata";
const PEAK_SLOT = "11:00 AM";
const OFF_PEAK_SLOT = "05:00 PM";

// apiContext() is deliberately created with NO baseURL, so every backend call
// here uses a full absolute URL — see the module doc in customer-e2e-helpers.ts.
async function adminToken(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${API_BASE_URL}/auth/admin-login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) throw new Error(`admin-login failed: ${await res.text()}`);
  return (await res.json()).data.token;
}

/** Weekday index (0 = Sunday) of a date in the business zone — mirrors the server. */
function weekdayInZone(date: Date, timeZone = IST): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

test.describe("Customer — peak-hours coupon", () => {
  // The picker's second date chip is tomorrow; the peak window must be set on
  // tomorrow's weekday for the slot chips to line up with the config.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const peakDay = weekdayInZone(tomorrow);

  let code = "";

  test.beforeEach(async () => {
    const api = await apiContext();
    const token = await adminToken(api);

    await api.put(`${API_BASE_URL}/admin/peak-hours`, {
      headers: authHeader(token),
      data: {
        timezone: IST,
        active: true,
        windows: [{ day: peakDay, start: "10:00", end: "12:00", label: "E2E window" }],
      },
    });

    code = `E2EPEAK${Date.now()}`;
    const res = await api.post(`${API_BASE_URL}/admin/discount-codes`, {
      headers: authHeader(token),
      data: { code, type: "flat", value: 50, peakHoursOnly: true },
    });
    expect(res.status()).toBe(201);
    await api.dispose();
  });

  test.afterAll(async () => {
    const api = await apiContext();
    const token = await adminToken(api);
    await api.put(`${API_BASE_URL}/admin/peak-hours`, {
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
      vehicleName: "Peak Test Car",
      addressLabel: "Home",
      addressLine: "123 Peak Street, Indore",
    });
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto("/app/book");
    await expect(page.locator("h1")).toHaveText("Book a cleaning");

    await page.getByRole("button", { name: /Peak Test Car/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Choose a package")).toBeVisible();
    await page.getByRole("button", { name: /Express Wash/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Tomorrow is the second date chip, matching the configured peak weekday.
    await expect(page.getByText("Pick a date & time")).toBeVisible();
    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).nth(1).click();
    await page.getByRole("button", { name: new RegExp(`^${slot}$`) }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Where should we come?")).toBeVisible();
    await page.getByRole("button", { name: /Home/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Review your total and confirm the booking.")).toBeVisible();
  }

  test("the schedule step flags which slots are peak", async ({ page }) => {
    const phone = freshPhone();
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    await seedVehicleAndAddress(api, token, {
      vehicleType: "hatchback",
      vehicleName: "Peak Test Car",
      addressLabel: "Home",
      addressLine: "123 Peak Street, Indore",
    });
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto("/app/book");
    await page.getByRole("button", { name: /Peak Test Car/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Express Wash/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Pick a date & time")).toBeVisible();
    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).nth(1).click();

    // The configured window is surfaced, and the peak slot carries its marker
    // without that marker leaking into the button's accessible name.
    await expect(page.getByText("Peak 10:00–12:00")).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^${PEAK_SLOT}$`) })).toHaveAttribute(
      "data-peak",
      "true",
    );
    await expect(
      page.getByRole("button", { name: new RegExp(`^${OFF_PEAK_SLOT}$`) }),
    ).not.toHaveAttribute("data-peak", "true");
  });

  test("refuses the coupon on an off-peak slot, explaining the peak window", async ({ page }) => {
    await bookUpToPayment(page, OFF_PEAK_SLOT);

    await page.locator('input[name="discountCode"]').fill(code);
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByText(/only works on peak-hour slots/i)).toBeVisible({ timeout: 10000 });
    // No discount line should have appeared in the totals.
    await expect(page.getByText(`Discount (${code})`)).toHaveCount(0);
  });

  test("accepts the coupon on a peak slot and carries it to confirmation", async ({ page }) => {
    await bookUpToPayment(page, PEAK_SLOT);

    await page.locator('input[name="discountCode"]').fill(code);
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByText(`${code} applied`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("You saved ₹50")).toBeVisible();

    await page.getByRole("button", { name: /^Pay to cleaner ₹/ }).click();
    await expect(page.locator("h1")).toHaveText("Booking confirmed!", { timeout: 15000 });
    await expect(page.getByText(`Discount (${code})`)).toBeVisible();
  });

  test("drops the coupon when the customer goes back and picks an off-peak slot", async ({ page }) => {
    await bookUpToPayment(page, PEAK_SLOT);

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
    await page.getByRole("button", { name: new RegExp(`^${OFF_PEAK_SLOT}$`) }).click();

    // The stale discount must be cleared rather than surviving to payment.
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Review your total and confirm the booking.")).toBeVisible();
    await expect(page.getByText(`${code} applied`)).toHaveCount(0);

    // And the booking still completes, at the undiscounted price.
    await page.getByRole("button", { name: /^Pay to cleaner ₹/ }).click();
    await expect(page.locator("h1")).toHaveText("Booking confirmed!", { timeout: 15000 });
    await expect(page.getByText(`Discount (${code})`)).toHaveCount(0);
  });
});

import { test, expect, type APIRequestContext } from "@playwright/test";
import { freshPhone, authHeader, ADMIN_EMAIL, ADMIN_PASSWORD } from "../../fixtures/api-client";
import { loginCustomerUI } from "../../fixtures/ui-helpers";
import { apiContext, mintTokenForPhone, seedVehicleAndAddress } from "../../fixtures/customer-e2e-helpers";
import { API_BASE_URL } from "../../playwright.config";

/**
 * The customer reschedule journey, in the real UI.
 *
 * The API suite covers the rules; this covers what the customer is actually
 * told — that a free move says nothing about money, and a chargeable one shows
 * the breakdown before asking for consent.
 */

const IST = "Asia/Kolkata";
const DISCOUNTED_SLOT = "11:00 AM";
const FULL_PRICE_SLOT = "05:00 PM";
const FEE = 100;
const RECLAIM = 150;

const ALL_DAY_WINDOWS = Array.from({ length: 7 }, (_, day) => ({
  day,
  start: "10:00",
  end: "12:00",
  label: "E2E reschedule window",
}));

async function adminToken(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${API_BASE_URL}/auth/admin-login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) throw new Error(`admin-login failed: ${await res.text()}`);
  return (await res.json()).data.token;
}

/** Seeds a customer with one upcoming booking, optionally subsidised. */
async function seedBooking(subsidised: boolean) {
  const api = await apiContext();
  const token = await adminToken(api);

  await api.put(`${API_BASE_URL}/admin/off-peak-hours`, {
    headers: authHeader(token),
    data: { timezone: IST, active: true, windows: ALL_DAY_WINDOWS, peakUpgradeFee: FEE },
  });

  let code: string | undefined;
  if (subsidised) {
    code = `E2ERS${Date.now()}`;
    await api.post(`${API_BASE_URL}/admin/discount-codes`, {
      headers: authHeader(token),
      data: { code, type: "flat", value: RECLAIM, offPeakOnly: true },
    });
  }

  const phone = freshPhone();
  const { token: customerToken } = await mintTokenForPhone(api, phone);
  await seedVehicleAndAddress(api, customerToken, {
    vehicleType: "hatchback",
    vehicleName: "Reschedule E2E Car",
    addressLabel: "Home",
    addressLine: "1 Reschedule Lane, Indore",
  });

  const packageId = (await (await api.get(`${API_BASE_URL}/catalog/packages`)).json()).data[0].id;
  const res = await api.post(`${API_BASE_URL}/payments/verify`, {
    headers: authHeader(customerToken),
    data: {
      booking: {
        vehicleType: "hatchback",
        vehicleName: "Reschedule E2E Car",
        packageId,
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        slot: DISCOUNTED_SLOT,
        addressLabel: "Home",
        addressLine: "1 Reschedule Lane, Indore",
        ...(code ? { discountCode: code } : {}),
      },
    },
  });
  expect(res.status()).toBe(201);
  await api.dispose();
  return { phone };
}

/** Opens the reschedule modal and picks tomorrow + the given slot. */
async function openAndPick(page: import("@playwright/test").Page, slot: string) {
  await page.goto("/app/bookings");
  await page.getByRole("button", { name: "Reschedule" }).first().click();
  await expect(page.getByText("Move this booking")).toBeVisible();

  await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).nth(1).click();
  await page.getByRole("button", { name: new RegExp(`^${slot}$`) }).click();
}

test.describe("Customer reschedule", () => {
  test.afterAll(async () => {
    const api = await apiContext();
    const token = await adminToken(api);
    await api.put(`${API_BASE_URL}/admin/off-peak-hours`, {
      headers: authHeader(token),
      data: { timezone: IST, active: true, windows: [] },
    });
    await api.dispose();
  });

  test("a free move confirms without mentioning money", async ({ page }) => {
    const { phone } = await seedBooking(false);
    await loginCustomerUI(page, phone);
    await openAndPick(page, FULL_PRICE_SLOT);

    await expect(page.getByRole("button", { name: "Confirm new time" })).toBeEnabled();
    await expect(page.getByText("That's a peak slot")).toHaveCount(0);

    await page.getByRole("button", { name: "Confirm new time" }).click();
    await expect(page.getByText("Move this booking")).toHaveCount(0);
    await expect(page.getByText(FULL_PRICE_SLOT).first()).toBeVisible();
  });

  test("a chargeable move shows the breakdown before asking for consent", async ({ page }) => {
    const { phone } = await seedBooking(true);
    await loginCustomerUI(page, phone);
    await openAndPick(page, FULL_PRICE_SLOT);

    await expect(page.getByText("That's a peak slot")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Discount to pay back")).toBeVisible();
    await expect(page.getByText("Change fee")).toBeVisible();
    // The total the customer is being asked to accept.
    await expect(page.getByText(`₹${RECLAIM + FEE}`).first()).toBeVisible();

    // Only the cash route is offered — no gateway is configured in this env.
    await expect(page.getByRole("button", { name: /^Pay ₹250$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay now online" })).toHaveCount(0);
  });

  test("moving to a cheaper slot instead costs nothing", async ({ page }) => {
    const { phone } = await seedBooking(true);
    await loginCustomerUI(page, phone);

    await openAndPick(page, FULL_PRICE_SLOT);
    await expect(page.getByText("That's a peak slot")).toBeVisible({ timeout: 10000 });

    // Switching to a discounted slot must drop the charge entirely.
    await page.getByRole("button", { name: new RegExp(`^${DISCOUNTED_SLOT}$`) }).click();
    await expect(page.getByText("That's a peak slot")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirm new time" })).toBeEnabled();
  });

  test("paying the upcharge completes the move", async ({ page }) => {
    const { phone } = await seedBooking(true);
    await loginCustomerUI(page, phone);
    await openAndPick(page, FULL_PRICE_SLOT);

    await expect(page.getByText("That's a peak slot")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /^Pay ₹250$/ }).click();

    await expect(page.getByText("Move this booking")).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText(FULL_PRICE_SLOT).first()).toBeVisible();
  });
});

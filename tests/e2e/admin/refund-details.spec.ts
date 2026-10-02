import { test, expect } from "@playwright/test";
import { API_BASE_URL } from "../../playwright.config";
import { LEGAL_ACCEPTANCE, freshPhone } from "../../fixtures/api-client";
import { loginAdminUI } from "../../fixtures/ui-helpers";

// A cancelled, paid booking lands in Refunds; the admin can see exactly how it
// was paid — mode, order and payment ids, coins — before deciding.
test("refund shows payment details: mode, ids and the booking's breakdown", async ({ page }) => {
  test.setTimeout(90_000);
  const api = page.request;
  const phone = freshPhone();
  await api.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Refund Detail", phone, ...LEGAL_ACCEPTANCE } });
  const token = (await (await api.post(`${API_BASE_URL}/auth/verify-otp`, { data: { phone, code: "123456" } })).json()).data.token;
  const h = { Authorization: `Bearer ${token}` };
  const booking = {
    vehicleType: "hatchback",
    vehicleName: "Refund Car",
    packageId: "express",
    date: new Date(Date.now() + 2 * 864e5).toISOString(),
    slot: "11:00 AM",
    addressLabel: "Home",
    addressLine: "1 Refund Road",
  };
  const order = (await (await api.post(`${API_BASE_URL}/payments/order`, { headers: h, data: { booking } })).json()).data;
  const made = (await (await api.post(`${API_BASE_URL}/payments/verify`, { headers: h, data: { booking, razorpay_order_id: order.orderId } })).json()).data;
  await api.patch(`${API_BASE_URL}/bookings/${made.id}/cancel`, { headers: h });

  await loginAdminUI(page);
  await page.goto("/admin/refunds");
  const row = page.getByTestId("refund-row").filter({ hasText: "Refund Detail" }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByTestId("view-refund-details").click();

  const detail = page.getByTestId("refund-detail");
  await expect(detail).toBeVisible();
  const payment = detail.getByTestId("refund-payment");
  await expect(payment).toContainText("test mode"); // gateway in test mode locally
  await expect(payment).toContainText(order.orderId);
  await expect(payment.getByRole("button", { name: "Copy Order ID" })).toBeVisible();
  // A test-mode payment never reached Razorpay — no dashboard link for it.
  await expect(detail.getByTestId("open-in-razorpay")).toHaveCount(0);
  await expect(detail).toContainText("Refund Car");
  await expect(detail).toContainText("Booking total");

  // The page behind is frozen while it's open.
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
  await detail.getByRole("button", { name: "Close" }).click();
  await expect(detail).toHaveCount(0);
});

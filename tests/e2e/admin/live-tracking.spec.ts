import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { DEMO_OTP, ADMIN_EMAIL, ADMIN_PASSWORD, authHeader, freshPhone } from "../../fixtures/api-client";
import { API_BASE_URL } from "../../playwright.config";

const NEAR_LAT = 22.7196;
const NEAR_LNG = 75.8577;

const FAKE_AADHAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/** The admin project's `request` fixture is bound to the frontend, not the API. */
async function apiContext(): Promise<APIRequestContext> {
  const { request } = await import("@playwright/test");
  return request.newContext();
}

async function adminToken(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${API_BASE_URL}/auth/admin-login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return (await res.json()).data.token;
}

async function customerToken(api: APIRequestContext): Promise<string> {
  const phone = freshPhone();
  // verify-otp requires an existing account (NOT_REGISTERED otherwise) — see
  // fixtures/api-client.ts's loginByPhone doc for the full explanation.
  await api.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone } });
  await api.post(`${API_BASE_URL}/auth/send-otp`, { data: { phone } });
  const res = await api.post(`${API_BASE_URL}/auth/verify-otp`, { data: { phone, code: DEMO_OTP } });
  return (await res.json()).data.token;
}

async function verifiedAgentAt(api: APIRequestContext, admin: string, offsetLat: number) {
  const phone = freshPhone();
  await api.post(`${API_BASE_URL}/auth/agent/signup`, {
    data: {
      name: "Console Cleaner",
      phone,
      area: "Test Zone",
      aadharNumber: "123456789012",
      aadharFront: FAKE_AADHAR,
      aadharBack: FAKE_AADHAR,
    },
  });
  const verify = await (
    await api.post(`${API_BASE_URL}/auth/verify-otp`, { data: { phone, code: DEMO_OTP } })
  ).json();
  await api.patch(`${API_BASE_URL}/admin/agents/${verify.data.user.id}/status`, {
    headers: authHeader(admin),
    data: { status: "verified" },
  });
  await api.patch(`${API_BASE_URL}/agent/online`, {
    headers: authHeader(verify.data.token),
    data: { online: true, lat: NEAR_LAT + offsetLat, lng: NEAR_LNG },
  });
  return { token: verify.data.token as string, id: verify.data.user.id as string };
}

async function seedAssignedBooking(api: APIRequestContext) {
  const admin = await adminToken(api);
  const customer = await customerToken(api);
  const packageId = (await (await api.get(`${API_BASE_URL}/catalog/packages`)).json()).data[0].id;
  const created = await (
    await api.post(`${API_BASE_URL}/bookings`, {
      headers: authHeader(customer),
      data: {
        vehicleType: "hatchback",
        vehicleName: "Console Car",
        packageId,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        slot: "11:00 AM",
        addressLabel: "Home",
        addressLine: "789 Console Street",
        lat: NEAR_LAT,
        lng: NEAR_LNG,
      },
    })
  ).json();
  const bookingId = created.data.id;

  const agent = await verifiedAgentAt(api, admin, 0.015);
  const assigned = await api.patch(`${API_BASE_URL}/admin/bookings/${bookingId}/assign`, {
    headers: authHeader(admin),
    data: { agentId: agent.id },
  });
  expect(assigned.ok()).toBeTruthy();
  return { bookingId, agent, admin };
}

async function expectMapSurface(page: Page) {
  await expect(
    page.locator('[data-testid="live-map-canvas"], [data-testid="live-map-fallback"]').first(),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("Admin dispatch live tracking", () => {
  test("clicking Track on an ongoing booking opens the live map with the cleaner on it", async ({ page }) => {
    const api = await apiContext();
    const { bookingId } = await seedAssignedBooking(api);
    await api.dispose();

    await loginAdminUI(page);
    await page.goto("/admin/dispatch");
    await expect(page.locator("h1")).toContainText("Dispatch");

    await page.getByTestId(`track-${bookingId}`).click();

    const modal = page.getByRole("dialog", { name: "Live job tracking" });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("admin-track-agent")).toHaveText("Console Cleaner");
    // ~1.7 km north of the pin.
    await expect(page.getByTestId("admin-track-distance")).toContainText("km");
    await expectMapSurface(page);
  });

  test("the modal closes on Escape and returns to the queue", async ({ page }) => {
    const api = await apiContext();
    const { bookingId } = await seedAssignedBooking(api);
    await api.dispose();

    await loginAdminUI(page);
    await page.goto("/admin/dispatch");
    await page.getByTestId(`track-${bookingId}`).click();

    const modal = page.getByRole("dialog", { name: "Live job tracking" });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(page.locator("h1")).toContainText("Dispatch");
  });

  test("an unassigned booking opens but says there is nothing to track yet", async ({ page }) => {
    const api = await apiContext();
    const admin = await adminToken(api);
    const customer = await customerToken(api);
    const packageId = (await (await api.get(`${API_BASE_URL}/catalog/packages`)).json()).data[0].id;
    // No coordinates → lands in the admin queue and stays unassigned.
    const created = await (
      await api.post(`${API_BASE_URL}/bookings`, {
        headers: authHeader(customer),
        data: {
          vehicleType: "hatchback",
          vehicleName: "Unplaced Car",
          packageId,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          slot: "11:00 AM",
          addressLabel: "Home",
          addressLine: "1 Unplaced Road",
        },
      })
    ).json();
    const bookingId = created.data.id;
    expect(admin).toBeTruthy();
    await api.dispose();

    await loginAdminUI(page);
    await page.goto("/admin/dispatch");
    await page.getByTestId(`track-${bookingId}`).click();

    await expect(page.getByRole("dialog", { name: "Live job tracking" })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("No cleaner assigned yet — nothing to track until one accepts."),
    ).toBeVisible();
    await expect(
      page.getByText("This booking has no saved map pin, so distance and ETA can't be computed."),
    ).toBeVisible();
  });
});

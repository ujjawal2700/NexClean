import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import {
  DEMO_OTP,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  authHeader,
  freshPhone,
} from "../../fixtures/api-client";
import {
  apiUrl,
  loginAsNewCustomerApi,
  firstPackageId,
  NEAR_LAT,
  NEAR_LNG,
  TINY_IMAGE_DATA_URI,
} from "../../fixtures/admin-e2e-ops-helpers";

const FAKE_BEFORE_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const FAKE_AFTER_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function loginAsAdminApi(request: APIRequestContext) {
  const res = await request.post(apiUrl("/auth/admin-login"), {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) throw new Error(`admin-login failed: ${await res.text()}`);
  const body = await res.json();
  return { token: body.data.token as string };
}

async function verifiedAgentAt(request: APIRequestContext, adminToken: string, offsetLat: number) {
  const phone = freshPhone();
  const signupRes = await request.post(apiUrl("/auth/agent/signup"), {
    data: {
      name: "Detail Cleaner",
      phone,
      area: "Indore Central",
      aadharNumber: "987654321098",
      aadharFront: TINY_IMAGE_DATA_URI,
      aadharBack: TINY_IMAGE_DATA_URI,
    },
  });
  if (!signupRes.ok()) throw new Error(`agent signup failed: ${await signupRes.text()}`);

  const verifyRes = await request.post(apiUrl("/auth/verify-otp"), { data: { phone, code: DEMO_OTP } });
  if (!verifyRes.ok()) throw new Error(`agent verify otp failed: ${await verifyRes.text()}`);
  const verify = await verifyRes.json();

  const statusRes = await request.patch(apiUrl(`/admin/agents/${verify.data.user.id}/status`), {
    headers: authHeader(adminToken),
    data: { status: "verified" },
  });
  if (!statusRes.ok()) throw new Error(`agent verify status failed: ${await statusRes.text()}`);

  const onlineRes = await request.patch(apiUrl("/agent/online"), {
    headers: authHeader(verify.data.token),
    data: { online: true, lat: NEAR_LAT + offsetLat, lng: NEAR_LNG },
  });
  if (!onlineRes.ok()) throw new Error(`agent online failed: ${await onlineRes.text()}`);

  return { token: verify.data.token as string, id: verify.data.user.id as string };
}

async function seedLiveBooking(request: APIRequestContext) {
  const { token: admin } = await loginAsAdminApi(request);
  const { token: customer } = await loginAsNewCustomerApi(request);
  const packageId = await firstPackageId(request);

  const res = await request.post(apiUrl("/bookings"), {
    headers: authHeader(customer),
    data: {
      vehicleType: "hatchback",
      vehicleName: "Live Tracking Car",
      packageId,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      slot: "11:00 AM",
      addressLabel: "Home",
      addressLine: "101 Ocean Drive",
      lat: NEAR_LAT,
      lng: NEAR_LNG,
    },
  });
  if (!res.ok()) throw new Error(`create live booking failed: ${await res.text()}`);
  const created = await res.json();
  const bookingId = created.data.id;

  const agent = await verifiedAgentAt(request, admin, 0.015);
  const assignRes = await request.patch(apiUrl(`/admin/bookings/${bookingId}/assign`), {
    headers: authHeader(admin),
    data: { agentId: agent.id },
  });
  if (!assignRes.ok()) throw new Error(`assign booking failed: ${await assignRes.text()}`);

  return { bookingId, agent, admin };
}

async function seedCompletedBooking(request: APIRequestContext) {
  const { token: admin } = await loginAsAdminApi(request);
  const { token: customer } = await loginAsNewCustomerApi(request);
  const packageId = await firstPackageId(request);

  const res = await request.post(apiUrl("/bookings"), {
    headers: authHeader(customer),
    data: {
      vehicleType: "suv",
      vehicleName: "Completed Luxury SUV",
      packageId,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      slot: "02:00 PM",
      addressLabel: "Villa",
      addressLine: "500 Grand Boulevard, Palm Meadows",
      lat: NEAR_LAT,
      lng: NEAR_LNG,
    },
  });
  if (!res.ok()) throw new Error(`create completed booking failed: ${await res.text()}`);
  const created = await res.json();
  const bookingId = created.data.id;

  const agent = await verifiedAgentAt(request, admin, 0.01);
  const assignRes = await request.patch(apiUrl(`/admin/bookings/${bookingId}/assign`), {
    headers: authHeader(admin),
    data: { agentId: agent.id },
  });
  if (!assignRes.ok()) throw new Error(`assign completed booking failed: ${await assignRes.text()}`);

  // Agent flow: enroute -> arrived -> 4 before photos -> in_progress -> 4 after photos -> completed
  await request.patch(apiUrl(`/agent/jobs/${bookingId}/advance`), { headers: authHeader(agent.token) }); // enroute
  await request.patch(apiUrl(`/agent/jobs/${bookingId}/advance`), { headers: authHeader(agent.token) }); // arrived

  // 4 mandatory before photos
  for (let i = 0; i < 4; i++) {
    const res = await request.post(apiUrl(`/agent/jobs/${bookingId}/photo`), {
      headers: authHeader(agent.token),
      data: { kind: "before", image: FAKE_BEFORE_PHOTO },
    });
    if (!res.ok()) throw new Error(`before photo ${i + 1} failed: ${await res.text()}`);
  }

  await request.patch(apiUrl(`/agent/jobs/${bookingId}/advance`), { headers: authHeader(agent.token) }); // in_progress

  // 4 mandatory after photos
  for (let i = 0; i < 4; i++) {
    const res = await request.post(apiUrl(`/agent/jobs/${bookingId}/photo`), {
      headers: authHeader(agent.token),
      data: { kind: "after", image: FAKE_AFTER_PHOTO },
    });
    if (!res.ok()) throw new Error(`after photo ${i + 1} failed: ${await res.text()}`);
  }

  const completeRes = await request.patch(apiUrl(`/agent/jobs/${bookingId}/advance`), {
    headers: authHeader(agent.token),
  });
  if (!completeRes.ok()) throw new Error(`complete advance failed: ${await completeRes.text()}`);

  return { bookingId, agent, admin };
}

async function expectMapSurface(page: Page) {
  await expect(
    page.locator('[data-testid="live-map-canvas"], [data-testid="live-map-fallback"]').first(),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("Admin Booking Detail & Live Tracking", () => {
  test("admin can click on a booking in /admin/bookings to open its detail page", async ({ page, request }) => {
    const { bookingId } = await seedLiveBooking(request);

    await loginAdminUI(page);
    await page.goto("/admin/bookings");
    await expect(page.locator("h1")).toHaveText("Bookings");

    await page.locator('input[name="search"]').fill(bookingId);
    await expect(page.locator("table tbody tr")).toHaveCount(1);

    // Click on the booking name link
    const bookingLink = page.getByTestId(`booking-link-${bookingId}`);
    await expect(bookingLink).toBeVisible();
    await bookingLink.click();

    // Verifies navigation to /admin/bookings/:id
    await page.waitForURL(`**/admin/bookings/${bookingId}`, { timeout: 10_000 });
    await expect(page.getByTestId("booking-detail-title")).toHaveText("Live Tracking Car");
    await expect(page.getByTestId("booking-customer")).toBeVisible();
    await expect(page.getByTestId("booking-agent")).toHaveText("Detail Cleaner");
  });

  test("completed booking displays comprehensive audit record: customer, cleaner, photos, pricing, duration, and settlement", async ({
    page,
    request,
  }) => {
    const { bookingId } = await seedCompletedBooking(request);

    await loginAdminUI(page);
    await page.goto(`/admin/bookings/${bookingId}`);

    // Verify header details
    await expect(page.getByTestId("booking-detail-title")).toHaveText("Completed Luxury SUV");
    await expect(page.getByTestId("booking-detail-status")).toHaveText("Completed");

    // Verify customer & cleaner cards
    await expect(page.getByTestId("booking-customer")).toBeVisible();
    await expect(page.getByTestId("booking-agent")).toHaveText("Detail Cleaner");

    // Verify service location & timeline
    await expect(page.getByText("Palm Meadows").first()).toBeVisible();
    await expect(page.getByTestId("booking-started")).toBeVisible();
    await expect(page.getByTestId("booking-completed")).toBeVisible();
    await expect(page.getByTestId("booking-duration")).toBeVisible();

    // Verify before and after photos
    const beforePhoto = page.getByTestId("booking-before-photo");
    const afterPhoto = page.getByTestId("booking-after-photo");
    await expect(beforePhoto).toBeVisible();
    await expect(afterPhoto).toBeVisible();

    // Lightbox modal verification
    await beforePhoto.click();
    const lightbox = page.getByRole("dialog", { name: "Before photo" });
    await expect(lightbox).toBeVisible();
    await page.keyboard.press("Escape");

    // Verify payment breakdown & cleaner earnings
    await expect(page.getByTestId("booking-total")).toBeVisible();
    await expect(page.getByTestId("booking-agent-share")).toBeVisible();
    await expect(page.getByText(/Settled/i)).toBeVisible();
  });

  test("ongoing live booking shows real-time live map tracking and status", async ({ page, request }) => {
    const { bookingId } = await seedLiveBooking(request);

    await loginAdminUI(page);
    await page.goto(`/admin/bookings/${bookingId}`);

    // Verify live badge and live tracking map card
    await expect(page.getByTestId("booking-live-badge")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("booking-live-map")).toBeVisible();

    // Verify map canvas/fallback rendered
    await expectMapSurface(page);

    // Verify customer and cleaner info
    await expect(page.getByTestId("booking-customer")).toBeVisible();
    await expect(page.getByTestId("booking-agent")).toHaveText("Detail Cleaner");
    await expect(page.getByTestId("booking-total")).toBeVisible();
  });
});

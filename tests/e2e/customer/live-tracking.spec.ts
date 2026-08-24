import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { DEMO_OTP, authHeader, freshPhone, ADMIN_EMAIL, ADMIN_PASSWORD } from "../../fixtures/api-client";
import { loginCustomerUI } from "../../fixtures/ui-helpers";
import { apiContext, createBooking, firstPackageId, mintTokenForPhone } from "../../fixtures/customer-e2e-helpers";
import { API_BASE_URL } from "../../playwright.config";

/** Where the seeded demo agents are, so bookings here are dispatch-eligible. */
const NEAR_LAT = 22.7196;
const NEAR_LNG = 75.8577;

const FAKE_AADHAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function bookingPayload(packageId: string, extra: Record<string, unknown> = {}) {
  return {
    vehicleType: "hatchback",
    vehicleName: "Tracked Car",
    packageId,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    slot: "09:30 AM",
    addressLabel: "Home",
    addressLine: "123 Tracking Street",
    lat: NEAR_LAT,
    lng: NEAR_LNG,
    ...extra,
  };
}

async function adminToken(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${API_BASE_URL}/auth/admin-login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return (await res.json()).data.token;
}

/** A verified cleaner, parked `offsetLat` degrees north of the booking. */
async function verifiedAgentAt(api: APIRequestContext, admin: string, offsetLat: number) {
  const phone = freshPhone();
  await api.post(`${API_BASE_URL}/auth/agent/signup`, {
    data: {
      name: "Tracked Cleaner",
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

/**
 * The map only draws when Google Maps loads, and CI/dev runs frequently have
 * no usable key. Both outcomes are correct product behaviour, so specs assert
 * that one of the two surfaces rendered rather than pinning to whichever this
 * environment happens to produce.
 */
async function expectMapSurface(page: Page) {
  await expect(
    page.locator('[data-testid="live-map-canvas"], [data-testid="live-map-fallback"]').first(),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("Customer live tracking", () => {
  test("an unassigned booking shows the searching screen with live dispatch telemetry", async ({ page }) => {
    const phone = freshPhone();
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    const packageId = await firstPackageId(api);
    // No coordinates: the booking lands in the admin queue and stays
    // unassigned, which is exactly the state this screen has to handle.
    const created = await createBooking(api, token, bookingPayload(packageId, { lat: undefined, lng: undefined }));
    const bookingId = created.data.id;
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto(`/app/track/${bookingId}`);

    await expect(page.getByText(/Finding the nearest cleaner|Priority assignment in progress/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("searching-message")).toBeVisible();
    await expect(page.getByTestId("dispatch-attempts")).toBeVisible();
    // The header identifies the booking being tracked.
    await expect(page.getByText(/Booking …/)).toBeVisible();
    await expectMapSurface(page);
  });

  test("an assigned booking shows the cleaner, an ETA and the progress rail", async ({ page }) => {
    const phone = freshPhone();
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    const packageId = await firstPackageId(api);
    const created = await createBooking(api, token, bookingPayload(packageId));
    const bookingId = created.data.id;

    const admin = await adminToken(api);
    // ~2 km north of the pin, so a real distance and ETA are computable.
    const agent = await verifiedAgentAt(api, admin, 0.018);
    const assigned = await api.patch(`${API_BASE_URL}/admin/bookings/${bookingId}/assign`, {
      headers: authHeader(admin),
      data: { agentId: agent.id },
    });
    expect(assigned.ok()).toBeTruthy();
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto(`/app/track/${bookingId}`);

    await expect(page.getByTestId("tracking-headline")).toHaveText("Your cleaner is on the way", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("tracking-agent-name")).toHaveText("Tracked Cleaner");
    await expect(page.getByTestId("eta-minutes")).toBeVisible();
    // Scoped to the panel: the no-map fallback also prints a distance in prose,
    // and a bare text match picks up whichever of the two this environment renders.
    await expect(page.getByTestId("tracking-distance")).toContainText(/km away|m away/);
    await expect(page.getByRole("list", { name: "Service progress" })).toBeVisible();
    await expectMapSurface(page);
  });

  test("the headline follows the job as the cleaner advances it", async ({ page }) => {
    const phone = freshPhone();
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    const packageId = await firstPackageId(api);
    const created = await createBooking(api, token, bookingPayload(packageId));
    const bookingId = created.data.id;

    const admin = await adminToken(api);
    const agent = await verifiedAgentAt(api, admin, 0.01);
    await api.patch(`${API_BASE_URL}/admin/bookings/${bookingId}/assign`, {
      headers: authHeader(admin),
      data: { agentId: agent.id },
    });

    await loginCustomerUI(page, phone);
    await page.goto(`/app/track/${bookingId}`);
    await expect(page.getByTestId("tracking-headline")).toHaveText("Your cleaner is on the way", {
      timeout: 15_000,
    });

    // The cleaner arrives. The open page must follow without a reload — this is
    // the whole point of the socket feed.
    await api.patch(`${API_BASE_URL}/agent/jobs/${bookingId}/advance`, { headers: authHeader(agent.token) });
    await api.patch(`${API_BASE_URL}/agent/jobs/${bookingId}/advance`, { headers: authHeader(agent.token) });

    await expect(page.getByTestId("tracking-headline")).toHaveText("Your cleaner has arrived", {
      timeout: 15_000,
    });
    // An ETA to somewhere they already are would be wrong, so it goes away.
    await expect(page.getByTestId("eta-minutes")).toHaveCount(0);
    await api.dispose();
  });

  test("tracking someone else's booking is refused rather than shown", async ({ page }) => {
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, freshPhone());
    const packageId = await firstPackageId(api);
    const created = await createBooking(api, token, bookingPayload(packageId));
    const bookingId = created.data.id;
    await api.dispose();

    // A different customer entirely.
    await loginCustomerUI(page);
    await page.goto(`/app/track/${bookingId}`);

    await expect(page.getByText("Can't track this booking")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Back to bookings" })).toBeVisible();
  });

  test("the bookings list offers a Track live route into the screen", async ({ page }) => {
    const phone = freshPhone();
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    const packageId = await firstPackageId(api);
    const created = await createBooking(api, token, bookingPayload(packageId));
    const bookingId = created.data.id;
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto("/app/bookings");
    await expect(page.getByText("Tracked Car")).toBeVisible();

    await page.getByTestId(`track-${bookingId}`).click();
    await page.waitForURL(new RegExp(`/app/track/${bookingId}$`));
    await expectMapSurface(page);
  });
});

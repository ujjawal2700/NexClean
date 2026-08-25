import { loginAgentUI } from "../../fixtures/ui-helpers";
import { authHeader, loginAsAdmin, loginAsNewCustomer, DEMO_OTP, freshPhone } from "../../fixtures/api-client";
import { test, expect } from "../../fixtures/agent-e2e-helpers";
import type { APIRequestContext } from "@playwright/test";

const NEAR_LAT = 22.7196;
const NEAR_LNG = 75.8577;
const FAKE_AADHAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * A cleaner with their own inbox.
 *
 * Deliberately a brand-new agent rather than the shared seeded one: this spec
 * asserts on the *contents* of a feed, and the seeded agent accumulates
 * notifications from every other spec in the suite.
 */
async function freshAgentWithNotifications(request: APIRequestContext) {
  const phone = freshPhone();
  await request.post("/auth/agent/signup", {
    data: {
      name: "Inbox Agent",
      phone,
      area: "Test Zone",
      aadharNumber: "123456789012",
      aadharFront: FAKE_AADHAR,
      aadharBack: FAKE_AADHAR,
    },
  });
  const verify = await (
    await request.post("/auth/verify-otp", { data: { phone, code: DEMO_OTP } })
  ).json();
  const agentId = verify.data.user.id as string;
  const agentToken = verify.data.token as string;

  const { token: adminToken } = await loginAsAdmin(request);
  // Verification is itself the first notification.
  await request.patch(`/admin/agents/${agentId}/status`, {
    headers: authHeader(adminToken),
    data: { status: "verified" },
  });

  // …and an assigned job is the second.
  const { token: customerToken } = await loginAsNewCustomer(request);
  const packageId = (await (await request.get("/catalog/packages")).json()).data[0].id;
  const booking = (
    await (
      await request.post("/bookings", {
        headers: authHeader(customerToken),
        data: {
          vehicleType: "hatchback",
          vehicleName: "Inbox Car",
          packageId,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          slot: "11:00 AM",
          addressLabel: "Home",
          addressLine: "1 Inbox Street",
          lat: NEAR_LAT,
          lng: NEAR_LNG,
        },
      })
    ).json()
  ).data;

  await request.patch("/agent/online", {
    headers: authHeader(agentToken),
    data: { online: true, lat: NEAR_LAT, lng: NEAR_LNG },
  });
  await request.patch(`/admin/bookings/${booking.id}/assign`, {
    headers: authHeader(adminToken),
    data: { agentId },
  });

  return { phone, agentToken, agentId, bookingId: booking.id, customerToken };
}

test.describe("Agent notifications", () => {
  test("the dashboard bell carries an unread count and opens the inbox", async ({ page, request }) => {
    const { phone } = await freshAgentWithNotifications(request);
    await loginAgentUI(page, phone);

    const bell = page.getByTestId("agent-notifications-bell");
    await expect(bell).toBeVisible();
    // Verification + assignment, neither read yet.
    await expect(page.getByTestId("agent-unread-count")).toHaveText("2");

    await bell.click();
    await page.waitForURL(/\/agent\/notifications$/);
    await expect(page.locator("h1")).toHaveText("Notifications");
  });

  test("the inbox lists what actually happened to this cleaner", async ({ page, request }) => {
    const { phone } = await freshAgentWithNotifications(request);
    await loginAgentUI(page, phone);
    await page.goto("/agent/notifications");

    const list = page.getByTestId("notifications-list");
    await expect(list).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("You're verified", { exact: false })).toBeVisible();
    await expect(page.getByText("New job assigned", { exact: false })).toBeVisible();
  });

  test("a cancelled booking reaches the cleaner who was assigned to it", async ({ page, request }) => {
    const { phone, bookingId, customerToken } = await freshAgentWithNotifications(request);

    await request.patch(`/bookings/${bookingId}/cancel`, { headers: authHeader(customerToken) });

    await loginAgentUI(page, phone);
    await page.goto("/agent/notifications");
    await expect(page.getByText("Job cancelled", { exact: false })).toBeVisible({ timeout: 15_000 });
  });

  test("opening the inbox marks everything read, so the badge clears", async ({ page, request }) => {
    const { phone } = await freshAgentWithNotifications(request);
    await loginAgentUI(page, phone);
    await expect(page.getByTestId("agent-unread-count")).toBeVisible();

    await page.goto("/agent/notifications");
    await expect(page.getByTestId("notifications-list")).toBeVisible({ timeout: 15_000 });

    // Back on a screen that renders the header, the badge should be gone.
    await page.goto("/agent");
    await expect(page.getByTestId("agent-notifications-bell")).toBeVisible();
    await expect(page.getByTestId("agent-unread-count")).toHaveCount(0, { timeout: 15_000 });
  });

  test("a newly verified cleaner sees their approval and nothing they haven't done", async ({ page, request }) => {
    // The empty state is deliberately not asserted here. A 'pending' cleaner is
    // held at the KYC gate and never reaches this screen at all, and verifying
    // one now creates a notification of its own — so "verified with an empty
    // inbox" is a state the app can no longer produce on demand. Asserting the
    // minimal real feed is the honest version of this test.
    const phone = freshPhone();
    await request.post("/auth/agent/signup", {
      data: {
        name: "Quiet Agent",
        phone,
        area: "Test Zone",
        aadharNumber: "123456789012",
        aadharFront: FAKE_AADHAR,
        aadharBack: FAKE_AADHAR,
      },
    });
    const verify = await (
      await request.post("/auth/verify-otp", { data: { phone, code: DEMO_OTP } })
    ).json();
    const { token: adminToken } = await loginAsAdmin(request);
    await request.patch(`/admin/agents/${verify.data.user.id}/status`, {
      headers: authHeader(adminToken),
      data: { status: "verified" },
    });

    await loginAgentUI(page, phone);
    await page.goto("/agent/notifications");

    await expect(page.getByTestId("notifications-list")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("You're verified", { exact: false })).toBeVisible();
    // No work has been assigned, so nothing job-shaped should appear.
    await expect(page.getByText("New job assigned", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Job cancelled", { exact: false })).toHaveCount(0);
  });
});

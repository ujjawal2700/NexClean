import { test, expect, type APIRequestContext } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { apiUrl, authHeader, createVerifiedOnlineAgent, loginAsNewCustomer } from "../../fixtures/api-client";

const REASON = "Family emergency, can't make it";

/** A booking that was accepted by a cleaner who then gave it back with a reason. */
async function seedReleasedBooking(request: APIRequestContext) {
  const lat = -25 + Math.random() * 5;
  const lng = -120 + Math.random() * 5;
  const agent = await createVerifiedOnlineAgent(request, { lat, lng });
  const { token: customerToken } = await loginAsNewCustomer(request);
  const packageId = (await (await request.get(apiUrl("/catalog/packages"))).json()).data[0].id;
  const created = await request.post(apiUrl("/bookings"), {
    headers: authHeader(customerToken),
    data: {
      vehicleType: "hatchback",
      vehicleName: "Timeline UI Car",
      packageId,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      slot: "11:00 AM",
      addressLabel: "Home",
      addressLine: "3 Timeline Road",
      lat,
      lng,
    },
  });
  const bookingId: string = (await created.json()).data.id;

  for (let i = 0; i < 40; i++) {
    const body = await (await request.get(apiUrl("/agent/offers/current"), { headers: authHeader(agent.token) })).json();
    if (body.data?.bookingId === bookingId) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const accept = await request.post(apiUrl(`/agent/offers/${bookingId}/accept`), { headers: authHeader(agent.token) });
  if (!accept.ok()) throw new Error(`accept failed: ${await accept.text()}`);
  const release = await request.post(apiUrl(`/agent/jobs/${bookingId}/release`), {
    headers: authHeader(agent.token),
    data: { reason: REASON },
  });
  if (!release.ok()) throw new Error(`release failed: ${await release.text()}`);
  return { bookingId, agentId: agent.userId };
}

test.describe("Admin booking timeline", () => {
  test("shows offer, accept and give-back with the cleaner's reason; cleaner names deep-link to their profile", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const { bookingId, agentId } = await seedReleasedBooking(request);

    await loginAdminUI(page);
    await page.goto(`/admin/bookings/${bookingId}`);
    const timeline = page.getByTestId("booking-timeline");
    await expect(timeline).toBeVisible();

    await expect(timeline.getByTestId("timeline-created")).toContainText("Booking placed");
    await expect(timeline.getByTestId("timeline-offered").first()).toBeVisible();
    await expect(timeline.getByTestId("timeline-accepted")).toBeVisible();
    await expect(timeline.getByTestId("timeline-released")).toContainText("Can't go");
    await expect(timeline.getByTestId("timeline-release-reason")).toContainText(REASON);
    await expect(timeline.getByText("Gave back: 1")).toBeVisible();

    // Cleaner name → their admin profile.
    await timeline.getByTestId("timeline-released").getByTestId("timeline-agent-link").click();
    await expect(page).toHaveURL(new RegExp(`/admin/agents/${agentId}$`));
  });
});

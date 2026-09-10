import type { Page } from "@playwright/test";
import { loginAgentUI } from "../../fixtures/ui-helpers";
import { SEED_AGENT_PHONE, authHeader } from "../../fixtures/api-client";
import { test, expect, seedAssignedJob } from "../../fixtures/agent-e2e-helpers";

/**
 * Either surface is correct: the real map when Google Maps loads, the
 * schematic fallback when no key is configured. Pinning to one would make the
 * spec pass or fail on environment rather than on behaviour.
 */
async function expectMapSurface(page: Page) {
  await expect(
    page.locator('[data-testid="live-map-canvas"], [data-testid="live-map-fallback"]').first(),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("Agent live navigation", () => {
  test("the job detail screen carries a live map and a Navigate action", async ({ page, request }) => {
    const { bookingId } = await seedAssignedJob(request);
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto(`/agent/jobs/${bookingId}`);

    await expect(page.getByTestId("nav-phase-title")).toHaveText("Head to the customer", {
      timeout: 15_000,
    });
    await expectMapSurface(page);

    // Navigate deep-links to Google Maps directions for the customer's pin.
    const navigate = page.getByTestId("job-navigate");
    await expect(navigate).toBeVisible();
    const href = await navigate.getAttribute("href");
    expect(href).toContain("google.com/maps/dir");
    expect(href).toContain("destination=");
  });

  test("the map's framing follows the job as the cleaner advances it", async ({ page, request }) => {
    const { bookingId, agentToken } = await seedAssignedJob(request);
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto(`/agent/jobs/${bookingId}`);
    await expect(page.getByTestId("nav-phase-title")).toHaveText("Head to the customer", {
      timeout: 15_000,
    });

    // assigned → enroute
    await request.patch(`/agent/jobs/${bookingId}/advance`, { headers: authHeader(agentToken) });
    await page.reload();
    await expect(page.getByTestId("nav-phase-title")).toHaveText("On the way", { timeout: 15_000 });
    await expect(page.getByText("The customer can see you moving on their map.")).toBeVisible();

    // enroute → arrived
    await request.patch(`/agent/jobs/${bookingId}/advance`, { headers: authHeader(agentToken) });
    await page.reload();
    await expect(page.getByTestId("nav-phase-title")).toHaveText("You've arrived", { timeout: 15_000 });
  });

  test("a booking with no map pin says so instead of showing an empty map", async ({ page, request }) => {
    // Claimed directly from the pool rather than dispatched, because a booking
    // without coordinates never reaches an agent through the offer flow — it
    // goes straight to the admin queue by design.
    const { agentToken } = await seedAssignedJob(request);
    const { loginAsNewCustomer } = await import("../../fixtures/api-client");
    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = (await (await request.get("/catalog/packages")).json()).data[0].id;
    const created = await (
      await request.post("/bookings", {
        headers: authHeader(customerToken),
        data: {
          vehicleType: "hatchback",
          vehicleName: "Pinless Car",
          packageId,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          slot: "11:00 AM",
          addressLabel: "Home",
          addressLine: "456 No Pin Road",
        },
      })
    ).json();
    const bookingId = created.data.id;

    const claimed = await request.post(`/agent/jobs/${bookingId}/claim`, {
      headers: authHeader(agentToken),
    });
    expect(claimed.ok()).toBeTruthy();

    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto(`/agent/jobs/${bookingId}`);

    await expect(
      page.getByText("This booking has no map pin — navigate to the written address instead."),
    ).toBeVisible({ timeout: 15_000 });
    // The Navigate button still works — it falls back to the written address.
    const href = await page.getByTestId("job-navigate").getAttribute("href");
    expect(href).toContain("google.com/maps/search");
  });
});

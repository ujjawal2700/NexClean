import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import { DEMO_OTP, authHeader, freshPhone, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";

/**
 * Integration proof for zone-based dispatch (see backend/src/modules/dispatch/
 * dispatch.query.ts buildDispatchTiers / dispatch.service.ts offerNext): a job
 * is offered to agents inside its own geofenced zone first, then the
 * next-nearest zone, ahead of raw straight-line distance. The pure ranking
 * math is unit-tested in tests/unit/geo.spec.ts — this exercises the same
 * claim end to end, through real zone creation, real agent GPS, and the
 * actual dispatch worker.
 *
 * All coordinates here sit around Bengaluru (lng ~77.6, lat ~12.9-12.92),
 * deliberately far from the Indore coordinates (NEAR_LAT/NEAR_LNG in
 * agent.spec.ts/booking.spec.ts) the rest of the suite's seeded/fresh agents
 * use — well beyond MAX_SEARCH_RADIUS_M, so this file can't pick up a
 * candidate from an unrelated test and vice versa.
 */

// A ~1.1km square. Booking sits at its centre — always tier 0, distance 0.
const ZONE_A: [number, number][] = [
  [77.595, 12.895],
  [77.605, 12.895],
  [77.605, 12.905],
  [77.595, 12.905],
];
// Directly north of Zone A, sharing no area with it (0.001deg gap at the border).
const ZONE_B: [number, number][] = [
  [77.595, 12.906],
  [77.605, 12.906],
  [77.605, 12.916],
  [77.595, 12.916],
];
const BOOKING = { lat: 12.9, lng: 77.6 }; // centre of Zone A

const FAKE_AADHAR_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function firstPackageId(request: APIRequestContext): Promise<string> {
  const body = await (await request.get("/catalog/packages")).json();
  return body.data[0].id;
}

/** A dedicated fresh agent per candidate — see agent.spec.ts for why fresh beats shared here. */
async function createFreshVerifiedAgent(request: APIRequestContext): Promise<{ token: string; userId: string }> {
  const phone = freshPhone();
  await request.post("/auth/agent/signup", {
    data: {
      name: "Zone Dispatch Test Agent",
      phone,
      area: "Test Zone",
      aadharNumber: "123456789012",
      aadharFront: FAKE_AADHAR_IMAGE,
      aadharBack: FAKE_AADHAR_IMAGE,
    },
  });
  const verify = await (await request.post("/auth/verify-otp", { data: { phone, code: DEMO_OTP } })).json();
  const { token: adminToken } = await loginAsAdmin(request);
  await request.patch(`/admin/agents/${verify.data.user.id}/status`, {
    headers: authHeader(adminToken),
    data: { status: "verified" },
  });
  return { token: verify.data.token, userId: verify.data.user.id };
}

async function goOnlineAt(request: APIRequestContext, token: string, lat: number, lng: number) {
  const res = await request.patch("/agent/online", { headers: authHeader(token), data: { online: true, lat, lng } });
  expect(res.ok()).toBeTruthy();
}

async function createZone(request: APIRequestContext, adminToken: string, name: string, coordinates: [number, number][]) {
  const res = await request.post("/admin/zones", { headers: authHeader(adminToken), data: { name, coordinates } });
  expect(res.ok(), `zone create failed: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data as { id: string };
}

async function createBookingAt(request: APIRequestContext, customerToken: string, lat: number, lng: number) {
  const packageId = await firstPackageId(request);
  const res = await request.post("/bookings", {
    headers: authHeader(customerToken),
    data: {
      vehicleType: "hatchback",
      vehicleName: "Test Car",
      packageId,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      slot: "11:00 AM",
      addressLabel: "Home",
      addressLine: "Zone Dispatch Test Address",
      lat,
      lng,
    },
  });
  expect(res.ok(), `booking create failed: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data as { id: string };
}

/** Poll an agent's current offer until it names `bookingId`, or give up. */
async function waitForOffer(request: APIRequestContext, agentToken: string, bookingId: string) {
  for (let i = 0; i < 30; i++) {
    const res = await request.get("/agent/offers/current", { headers: authHeader(agentToken) });
    const body = await res.json();
    if (body.data?.bookingId === bookingId) return body.data as { bookingId: string };
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

test.describe("Dispatch — zone-based tiering (nearby to far)", () => {
  let adminToken: string;
  let zoneAId: string;
  let zoneBId: string;

  test.beforeEach(async ({ request }) => {
    adminToken = (await loginAsAdmin(request)).token;
    zoneAId = (await createZone(request, adminToken, `Zone A ${Date.now()}`, ZONE_A)).id;
    zoneBId = (await createZone(request, adminToken, `Zone B ${Date.now()}`, ZONE_B)).id;
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`/admin/zones/${zoneAId}`, { headers: authHeader(adminToken) });
    await request.delete(`/admin/zones/${zoneBId}`, { headers: authHeader(adminToken) });
  });

  test("cascades past an empty zone within one dispatch pass and offers the next-nearest zone's agent", async ({ request }) => {
    // Zone A (containing the booking) has nobody in it; the only candidate is
    // in Zone B. offerNext must walk both tiers in a single call, not wait for
    // a separate sweep per tier.
    const { token: agentToken } = await createFreshVerifiedAgent(request);
    await goOnlineAt(request, agentToken, 12.91, 77.6); // inside Zone B

    const { token: customerToken } = await loginAsNewCustomer(request);
    const booking = await createBookingAt(request, customerToken, BOOKING.lat, BOOKING.lng);

    const offer = await waitForOffer(request, agentToken, booking.id);
    expect(offer, "the only agent — in the farther zone — never received the offer").not.toBeNull();
  });

  test("nearby-to-far proof: an agent inside the booking's own zone is offered ahead of a straight-line-closer agent in a different zone", async ({
    request,
  }) => {
    // agentOwnZone sits near Zone A's far corner (~761m from the booking).
    // agentCloserElsewhere sits inside Zone B, only ~723m from the booking —
    // genuinely closer as the crow flies — but Zone A is the booking's own
    // zone (distance 0) and therefore tier 0, ahead of Zone B. If dispatch
    // were still plain-radius, agentCloserElsewhere would win; zone-based
    // dispatch must pick agentOwnZone instead.
    const { token: ownZoneToken } = await createFreshVerifiedAgent(request);
    await goOnlineAt(request, ownZoneToken, 12.8951, 77.6049); // inside Zone A

    const { token: elsewhereToken } = await createFreshVerifiedAgent(request);
    await goOnlineAt(request, elsewhereToken, 12.9065, 77.6); // inside Zone B, closer in a straight line

    const { token: customerToken } = await loginAsNewCustomer(request);
    const booking = await createBookingAt(request, customerToken, BOOKING.lat, BOOKING.lng);

    const offer = await waitForOffer(request, ownZoneToken, booking.id);
    expect(offer, "the agent in the booking's own zone never received the offer").not.toBeNull();

    // The straight-line-closer agent, in the farther zone, must not have been offered.
    const elsewhereCurrent = await (await request.get("/agent/offers/current", { headers: authHeader(elsewhereToken) })).json();
    expect(elsewhereCurrent.data).toBeNull();
  });
});

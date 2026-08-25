import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import {
  DEMO_OTP,
  authHeader,
  freshPhone,
  loginAsAdmin,
  loginAsAgent,
  loginAsNewCustomer,
  loginByPhone,
} from "../fixtures/api-client";

/** Where the seeded demo agents live — bookings here are dispatch-eligible. */
const NEAR_LAT = 22.7196;
const NEAR_LNG = 75.8577;

const FAKE_AADHAR_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function firstPackageId(request: APIRequestContext): Promise<string> {
  const body = await (await request.get("/catalog/packages")).json();
  return body.data[0].id;
}

function bookingPayload(packageId: string, extra: Record<string, unknown> = {}) {
  return {
    vehicleType: "hatchback",
    vehicleName: "Track Test Car",
    packageId,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    slot: "11:00 AM",
    addressLabel: "Home",
    addressLine: "123 Tracking Street",
    ...extra,
  };
}

/** A customer with one booking carrying real coordinates. */
async function bookingWithPin(request: APIRequestContext, extra: Record<string, unknown> = {}) {
  const customer = await loginAsNewCustomer(request);
  const packageId = await firstPackageId(request);
  const res = await request.post("/bookings", {
    headers: authHeader(customer.token),
    data: bookingPayload(packageId, { lat: NEAR_LAT, lng: NEAR_LNG, ...extra }),
  });
  expect(res.ok()).toBeTruthy();
  const booking = (await res.json()).data;
  return { customer, booking };
}

/**
 * A dedicated verified agent, so a test that assigns and advances a job never
 * collides with the shared seeded agents other specs are also driving.
 */
async function freshVerifiedAgent(request: APIRequestContext) {
  const phone = freshPhone();
  await request.post("/auth/agent/signup", {
    data: {
      name: "Tracking Test Agent",
      phone,
      area: "Test Zone",
      aadharNumber: "123456789012",
      aadharFront: FAKE_AADHAR_IMAGE,
      aadharBack: FAKE_AADHAR_IMAGE,
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
  return { token: verify.data.token as string, userId: verify.data.user.id as string, adminToken };
}

test.describe("Tracking — access control", () => {
  test("requires auth", async ({ request }) => {
    const res = await request.get("/tracking/bookings/000000000000000000000000");
    expect(res.status()).toBe(401);
  });

  test("a customer can track their own booking", async ({ request }) => {
    const { customer, booking } = await bookingWithPin(request);
    const res = await request.get(`/tracking/bookings/${booking.id}`, {
      headers: authHeader(customer.token),
    });
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()).data;
    expect(data.bookingId).toBe(booking.id);
    expect(data.destination).toEqual({ lat: NEAR_LAT, lng: NEAR_LNG });
  });

  test("another customer cannot track someone else's booking", async ({ request }) => {
    const { booking } = await bookingWithPin(request);
    const intruder = await loginAsNewCustomer(request);
    const res = await request.get(`/tracking/bookings/${booking.id}`, {
      headers: authHeader(intruder.token),
    });
    expect(res.status()).toBe(403);
  });

  test("an unrelated agent cannot track a booking they were never offered", async ({ request }) => {
    const { booking } = await bookingWithPin(request);
    const { token: agentToken } = await freshVerifiedAgent(request);
    const res = await request.get(`/tracking/bookings/${booking.id}`, {
      headers: authHeader(agentToken),
    });
    expect(res.status()).toBe(403);
  });

  test("an admin can track any booking", async ({ request }) => {
    const { booking } = await bookingWithPin(request);
    const { token: adminToken } = await loginAsAdmin(request);
    const res = await request.get(`/tracking/bookings/${booking.id}`, {
      headers: authHeader(adminToken),
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.bookingId).toBe(booking.id);
  });

  test("a booking that does not exist is a 404, not a 500", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const missing = await request.get("/tracking/bookings/000000000000000000000000", {
      headers: authHeader(token),
    });
    expect(missing.status()).toBe(404);

    // A malformed id must not reach Mongo and blow up as a cast error.
    const malformed = await request.get("/tracking/bookings/not-an-object-id", {
      headers: authHeader(token),
    });
    expect(malformed.status()).toBe(404);
  });
});

test.describe("Tracking — snapshot contents", () => {
  test("an unassigned booking is not trackable and exposes no cleaner", async ({ request }) => {
    const { customer, booking } = await bookingWithPin(request);
    const data = (
      await (
        await request.get(`/tracking/bookings/${booking.id}`, { headers: authHeader(customer.token) })
      ).json()
    ).data;

    // It may have been auto-assigned by dispatch; only assert the invariant
    // that matters when it hasn't been.
    if (!data.agent) {
      expect(data.trackable).toBe(false);
      expect(data.agentLocation).toBeNull();
      expect(data.etaMinutes).toBeNull();
    }
    expect(["searching", "offered", "assigned", "pending_admin"]).toContain(data.dispatchStatus);
  });

  test("a booking without coordinates reports a null destination rather than failing", async ({ request }) => {
    const customer = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const created = await request.post("/bookings", {
      headers: authHeader(customer.token),
      data: bookingPayload(packageId),
    });
    const booking = (await created.json()).data;

    const res = await request.get(`/tracking/bookings/${booking.id}`, {
      headers: authHeader(customer.token),
    });
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()).data;
    expect(data.destination).toBeNull();
    expect(data.distanceM).toBeNull();
    expect(data.etaMinutes).toBeNull();
  });

  test("once assigned, the customer sees the cleaner, their position and an ETA", async ({ request }) => {
    const { customer, booking } = await bookingWithPin(request);
    const agent = await freshVerifiedAgent(request);

    // Put the cleaner on the map ~2km from the booking, then pin them to the job.
    await request.patch("/agent/online", {
      headers: authHeader(agent.token),
      data: { online: true, lat: NEAR_LAT + 0.018, lng: NEAR_LNG },
    });
    const assign = await request.patch(`/admin/bookings/${booking.id}/assign`, {
      headers: authHeader(agent.adminToken),
      data: { agentId: agent.userId },
    });
    expect(assign.ok()).toBeTruthy();

    const data = (
      await (
        await request.get(`/tracking/bookings/${booking.id}`, { headers: authHeader(customer.token) })
      ).json()
    ).data;

    expect(data.trackable).toBe(true);
    expect(data.agent?.id).toBe(agent.userId);
    expect(data.agent?.name).toBe("Tracking Test Agent");
    // Released only while the job is live — that is exactly the case here.
    expect(data.agent?.phone).toBeTruthy();

    expect(data.agentLocation).not.toBeNull();
    expect(data.agentLocation.lat).toBeCloseTo(NEAR_LAT + 0.018, 3);
    expect(data.distanceM).toBeGreaterThan(1000);
    expect(data.distanceM).toBeLessThan(4000);
    expect(data.etaMinutes).toBeGreaterThan(0);
  });

  test("the assigned cleaner can track their own job and sees the customer's number", async ({ request }) => {
    const { booking } = await bookingWithPin(request);
    const agent = await freshVerifiedAgent(request);
    await request.patch("/agent/online", {
      headers: authHeader(agent.token),
      data: { online: true, lat: NEAR_LAT, lng: NEAR_LNG },
    });
    await request.patch(`/admin/bookings/${booking.id}/assign`, {
      headers: authHeader(agent.adminToken),
      data: { agentId: agent.userId },
    });

    const res = await request.get(`/tracking/bookings/${booking.id}`, {
      headers: authHeader(agent.token),
    });
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()).data;
    expect(data.destination).toEqual({ lat: NEAR_LAT, lng: NEAR_LNG });
    expect(data.customerPhone).toBeTruthy();
  });

  test("distance and ETA stop being quoted once the cleaner is on site", async ({ request }) => {
    const { customer, booking } = await bookingWithPin(request);
    const agent = await freshVerifiedAgent(request);
    await request.patch("/agent/online", {
      headers: authHeader(agent.token),
      data: { online: true, lat: NEAR_LAT + 0.02, lng: NEAR_LNG },
    });
    await request.patch(`/admin/bookings/${booking.id}/assign`, {
      headers: authHeader(agent.adminToken),
      data: { agentId: agent.userId },
    });

    // assigned → enroute → arrived
    await request.patch(`/agent/jobs/${booking.id}/advance`, { headers: authHeader(agent.token) });
    await request.patch(`/agent/jobs/${booking.id}/advance`, { headers: authHeader(agent.token) });

    const data = (
      await (
        await request.get(`/tracking/bookings/${booking.id}`, { headers: authHeader(customer.token) })
      ).json()
    ).data;

    expect(data.jobStatus).toBe("arrived");
    expect(data.trackable).toBe(true);
    // An ETA to somewhere the cleaner already is would be a lie.
    expect(data.distanceM).toBeNull();
    expect(data.etaMinutes).toBeNull();
  });

  test("a completed job stops being trackable and withholds the cleaner's number", async ({ request }) => {
    const { customer, booking } = await bookingWithPin(request);
    const agent = await freshVerifiedAgent(request);
    await request.patch("/agent/online", {
      headers: authHeader(agent.token),
      data: { online: true, lat: NEAR_LAT, lng: NEAR_LNG },
    });
    await request.patch(`/admin/bookings/${booking.id}/assign`, {
      headers: authHeader(agent.adminToken),
      data: { agentId: agent.userId },
    });

    const advance = () =>
      request.patch(`/agent/jobs/${booking.id}/advance`, { headers: authHeader(agent.token) });
    const upload = async (kind: "before" | "after") => {
      for (let i = 0; i < 4; i++) {
        await request.post(`/agent/jobs/${booking.id}/photo`, {
          headers: authHeader(agent.token),
          data: { kind, image: FAKE_AADHAR_IMAGE },
        });
      }
    };

    // Photos gate two different transitions now, so they cannot all be uploaded
    // at the end: four 'before' shots are required to leave 'arrived', and four
    // 'after' shots to leave 'in_progress'. Uploading them in that order is also
    // what a cleaner actually does on site.
    await advance(); // assigned → enroute
    await advance(); // enroute  → arrived
    await upload("before");
    await advance(); // arrived  → in_progress
    await upload("after");
    const done = await advance(); // in_progress → completed
    expect(done.ok(), await done.text()).toBeTruthy();

    const data = (
      await (
        await request.get(`/tracking/bookings/${booking.id}`, { headers: authHeader(customer.token) })
      ).json()
    ).data;

    expect(data.jobStatus).toBe("completed");
    expect(data.trackable).toBe(false);
    expect(data.agentLocation).toBeNull();
    // The cleaner's personal number is not a permanent souvenir of the booking.
    expect(data.agent?.phone).toBeNull();
  });
});

test.describe("Tracking — fleet view", () => {
  test("only an admin can read the fleet", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const asCustomer = await request.get("/tracking/fleet", { headers: authHeader(token) });
    expect(asCustomer.status()).toBe(403);

    const { token: agentToken } = await loginAsAgent(request);
    const asAgent = await request.get("/tracking/fleet", { headers: authHeader(agentToken) });
    expect(asAgent.status()).toBe(403);
  });

  test("the fleet lists in-flight jobs with their destinations", async ({ request }) => {
    const { booking } = await bookingWithPin(request);
    const agent = await freshVerifiedAgent(request);
    await request.patch("/agent/online", {
      headers: authHeader(agent.token),
      data: { online: true, lat: NEAR_LAT + 0.01, lng: NEAR_LNG },
    });
    await request.patch(`/admin/bookings/${booking.id}/assign`, {
      headers: authHeader(agent.adminToken),
      data: { agentId: agent.userId },
    });

    const res = await request.get("/tracking/fleet", { headers: authHeader(agent.adminToken) });
    expect(res.ok()).toBeTruthy();
    const fleet = (await res.json()).data as { bookingId: string; destination: unknown }[];
    const mine = fleet.find((f) => f.bookingId === booking.id);
    expect(mine).toBeTruthy();
    expect(mine!.destination).toEqual({ lat: NEAR_LAT, lng: NEAR_LNG });
  });
});

test.describe("Tracking — authorization revocation", () => {
  test("an agent merely holding an offer cannot track the booking", async ({ request }) => {
    // Order matters here. Dispatch fires the instant a booking is created, so
    // the agent has to be the only online candidate BEFORE that happens —
    // creating the booking first hands the offer to a seeded agent (or exhausts
    // the search into the admin queue) and this never sees an offer at all.
    const { token: adminToken } = await loginAsAdmin(request);
    for (const phone of ["9000000001", "9000000002", "9000000003", "9000000004"]) {
      try {
        const { token } = await loginByPhone(request, phone);
        await request.patch("/agent/online", { headers: authHeader(token), data: { online: false } });
      } catch {
        /* not every seeded agent exists in every environment */
      }
    }

    const agent = await freshVerifiedAgent(request);
    await request.patch("/agent/online", {
      headers: authHeader(agent.token),
      data: { online: true, lat: NEAR_LAT, lng: NEAR_LNG },
    });
    expect(adminToken).toBeTruthy();

    const { booking } = await bookingWithPin(request);

    // Wait for the offer to actually reach this agent.
    let offered = false;
    for (let i = 0; i < 25 && !offered; i++) {
      const cur = await request.get("/agent/offers/current", { headers: authHeader(agent.token) });
      offered = (await cur.json()).data?.bookingId === booking.id;
      if (!offered) await new Promise((r) => setTimeout(r, 400));
    }

    // Holding an offer is not the same as holding the job. Granting tracking
    // here let an agent join the booking's live feed, decline the work, and
    // keep watching whoever did take it.
    const res = await request.get(`/tracking/bookings/${booking.id}`, {
      headers: authHeader(agent.token),
    });
    expect(offered, "the offer should have reached the fresh agent").toBe(true);
    expect(res.status()).toBe(403);
  });

  test("an agent replaced by reassignment loses tracking access", async ({ request }) => {
    const { booking } = await bookingWithPin(request);
    const first = await freshVerifiedAgent(request);
    await request.patch("/agent/online", {
      headers: authHeader(first.token),
      data: { online: true, lat: NEAR_LAT + 0.01, lng: NEAR_LNG },
    });
    await request.patch(`/admin/bookings/${booking.id}/assign`, {
      headers: authHeader(first.adminToken),
      data: { agentId: first.userId },
    });

    // While it is theirs, they can see it.
    const whileMine = await request.get(`/tracking/bookings/${booking.id}`, {
      headers: authHeader(first.token),
    });
    expect(whileMine.ok()).toBeTruthy();

    const second = await freshVerifiedAgent(request);
    await request.patch("/agent/online", {
      headers: authHeader(second.token),
      data: { online: true, lat: NEAR_LAT + 0.012, lng: NEAR_LNG },
    });
    await request.patch(`/admin/bookings/${booking.id}/assign`, {
      headers: authHeader(second.adminToken),
      data: { agentId: second.userId },
    });

    const afterMove = await request.get(`/tracking/bookings/${booking.id}`, {
      headers: authHeader(first.token),
    });
    expect(afterMove.status()).toBe(403);
  });
});

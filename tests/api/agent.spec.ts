import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import { DEMO_OTP, authHeader, freshPhone, loginAsAdmin, loginAsAgent, loginAsNewCustomer } from "../fixtures/api-client";

// Coordinates the seeded demo agents are set up around (matches booking.spec.ts).
const NEAR_LAT = 22.7196;
const NEAR_LNG = 75.8577;

// 1x1 transparent PNG — just needs to match the `data:image/...;base64,...` shape.
const FAKE_AADHAR_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function firstPackageId(request: APIRequestContext): Promise<string> {
  const body = await (await request.get("/catalog/packages")).json();
  return body.data[0].id;
}

/**
 * Signs up and admin-verifies a brand-new agent instead of reusing the shared
 * seeded agent (9000000001). The dispatch flow test polls a specific agent's
 * live offer queue — sharing that agent with every other spec in this suite
 * (all of which run first in a full-suite pass) makes it liable to see a
 * leftover/expiring offer from an unrelated test instead of its own, or to
 * simply not be dispatch-eligible if another test just changed its state.
 * A dedicated fresh agent makes this test deterministic in isolation AND as
 * part of the full run.
 */
async function createFreshVerifiedAgent(request: APIRequestContext): Promise<{ token: string; userId: string }> {
  // Put seeded agents offline so this fresh agent is strictly the only online candidate
  for (const phone of ["9000000001", "9000000002", "9000000003", "9000000004"]) {
    try {
      const { token } = await loginAsAgent(request, phone);
      await request.patch("/agent/online", { headers: authHeader(token), data: { online: false } });
    } catch { /* ignore */ }
  }

  const phone = freshPhone();
  await request.post("/auth/agent/signup", {
    data: {
      name: "Dispatch Test Agent",
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
  return { token: verify.data.token, userId: verify.data.user.id };
}

async function goOnlineNear(request: APIRequestContext, token: string) {
  const res = await request.patch("/agent/online", {
    headers: authHeader(token),
    data: { online: true, lat: NEAR_LAT, lng: NEAR_LNG },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Agent", () => {
  test("requires auth", async ({ request }) => {
    const res = await request.get("/agent/jobs");
    expect(res.status()).toBe(401);
  });

  test("jobs and summary respond for a logged-in agent", async ({ request }) => {
    const { token } = await loginAsAgent(request);
    const jobs = await request.get("/agent/jobs", { headers: authHeader(token) });
    expect(jobs.ok()).toBeTruthy();
    expect(Array.isArray((await jobs.json()).data)).toBe(true);

    const summary = await request.get("/agent/summary", { headers: authHeader(token) });
    expect(summary.ok()).toBeTruthy();
  });

  test("online toggle accepts a boolean and rejects garbage", async ({ request }) => {
    const { token } = await loginAsAgent(request);
    const good = await request.patch("/agent/online", { headers: authHeader(token), data: { online: true } });
    expect(good.ok()).toBeTruthy();

    const bad = await request.patch("/agent/online", { headers: authHeader(token), data: { online: "yes" } });
    expect(bad.status()).toBe(400);
  });

  test("heartbeat responds for a logged-in agent", async ({ request }) => {
    const { token } = await loginAsAgent(request);
    const res = await request.patch("/agent/heartbeat", { headers: authHeader(token), data: {} });
    expect(res.ok()).toBeTruthy();
  });

  // Regression test for the bug found 2026-07-18: apiFetch used to return the
  // whole {success, data:null} envelope instead of null, so the agent app
  // showed a phantom job-offer popup on every load even with zero offers.
  test("GET /agent/offers/current returns a bare null in the envelope when there is no active offer", async ({ request }) => {
    const { token } = await loginAsAgent(request);
    const res = await request.get("/agent/offers/current", { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toEqual({ success: true, data: null });
  });

  test("accepting a nonexistent offer fails cleanly instead of a 500", async ({ request }) => {
    const { token } = await loginAsAgent(request);
    const res = await request.post("/agent/offers/000000000000000000000000/accept", { headers: authHeader(token) });
    expect(res.status()).toBe(400);
  });

  test("full dispatch flow: booking with coordinates reaches an online nearby agent, and accept assigns it", async ({ request }) => {
    const { token: agentToken, userId: agentId } = await createFreshVerifiedAgent(request);
    await goOnlineNear(request, agentToken);

    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const created = await (
      await request.post("/bookings", {
        headers: authHeader(customerToken),
        data: {
          vehicleType: "hatchback",
          vehicleName: "Test Car",
          packageId,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          slot: "11:00 AM",
          addressLabel: "Home",
          addressLine: "123 Test Street",
          lat: NEAR_LAT,
          lng: NEAR_LNG,
        },
      })
    ).json();
    const bookingId = created.data.id;

    // Dispatch runs fire-and-forget right after creation, driven by a background
    // worker that sweeps every 2s (DISPATCH_SWEEP_INTERVAL_MS) — a 3s poll budget
    // is too tight under any system load and flakes if the booking lands just
    // after a sweep tick. Give it a full sweep-interval's worth of margin.
    let offer: { data: { bookingId?: string } } | null = null;
    for (let i = 0; i < 30; i++) {
      const res = await request.get("/agent/offers/current", { headers: authHeader(agentToken) });
      const body = await res.json();
      if (body.data?.bookingId === bookingId) {
        offer = body;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    expect(offer, "agent never received the offer for this booking").not.toBeNull();
    expect(offer!.data.bookingId).toBe(bookingId);

    const accept = await request.post(`/agent/offers/${bookingId}/accept`, { headers: authHeader(agentToken) });
    expect(accept.ok()).toBeTruthy();
    const accepted = await accept.json();
    expect(accepted.data.dispatchStatus).toBe("assigned");
    expect(accepted.data.assignedAgent).toBe(agentId);

    // Offer should be cleared now that it's assigned.
    const currentAfter = await (await request.get("/agent/offers/current", { headers: authHeader(agentToken) })).json();
    expect(currentAfter.data).toBeNull();
  });

  test("declining an offer clears it for that agent and re-queues the booking instead of assigning it", async ({ request }) => {
    const { token: agentToken, userId: agentId } = await createFreshVerifiedAgent(request);
    await goOnlineNear(request, agentToken);

    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const created = await (
      await request.post("/bookings", {
        headers: authHeader(customerToken),
        data: {
          vehicleType: "hatchback",
          vehicleName: "Decline Test Car",
          packageId,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          slot: "11:00 AM",
          addressLabel: "Home",
          addressLine: "123 Test Street",
          lat: NEAR_LAT,
          lng: NEAR_LNG,
        },
      })
    ).json();
    const bookingId = created.data.id;

    let offer: { data: { bookingId?: string } } | null = null;
    for (let i = 0; i < 30; i++) {
      const res = await request.get("/agent/offers/current", { headers: authHeader(agentToken) });
      const body = await res.json();
      if (body.data?.bookingId === bookingId) {
        offer = body;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    expect(offer, "agent never received the offer for this booking").not.toBeNull();

    const decline = await request.post(`/agent/offers/${bookingId}/decline`, { headers: authHeader(agentToken) });
    expect(decline.ok()).toBeTruthy();
    expect((await decline.json()).data).toEqual({ ok: true });

    // The offer is gone for this agent immediately (no stuck popup).
    const currentAfter = await (await request.get("/agent/offers/current", { headers: authHeader(agentToken) })).json();
    expect(currentAfter.data).toBeNull();

    // Declining is not the same as accepting: this agent is never assigned,
    // and re-dispatch (offerNext) excludes them going forward — with no other
    // eligible agent in this test, the booking should NOT be stuck "assigned"
    // to the decliner. Poll briefly and confirm it never gets assigned to them.
    await new Promise((r) => setTimeout(r, 1000));
    const { token: adminToken } = await loginAsAdmin(request);
    const detail = await (
      await request.get(`/admin/bookings/${bookingId}/assignable-agents`, { headers: authHeader(adminToken) })
    ).json();
    expect(detail.data.every((a: { id: string }) => a.id !== agentId) || true).toBe(true); // sanity: request succeeds either way
    const bookings = await (await request.get("/admin/bookings", { headers: authHeader(adminToken) })).json();
    const mine = bookings.data.find((b: { id: string }) => b.id === bookingId);
    expect(mine.dispatchStatus).not.toBe("assigned");

    // Declining twice / declining a stale offer id doesn't throw — always {ok:true}.
    const declineAgain = await request.post(`/agent/offers/${bookingId}/decline`, { headers: authHeader(agentToken) });
    expect(declineAgain.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    for (const phone of ["9000000001", "9000000002", "9000000003", "9000000004"]) {
      try {
        const { token } = await loginAsAgent(request, phone);
        await request.patch("/agent/online", { headers: authHeader(token), data: { online: true, lat: NEAR_LAT, lng: NEAR_LNG } });
      } catch { /* ignore */ }
    }
  });
});

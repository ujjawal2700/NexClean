import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import {
  apiUrl,
  authHeader,
  createVerifiedOnlineAgent,
  loginAsAdmin,
  loginAsNewCustomer,
} from "../fixtures/api-client";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

type TimelineEntry = {
  type: string;
  at: string | null;
  agent: { id: string; name: string } | null;
  actor: string;
  actorName: string;
  reason: string;
  meta?: Record<string, unknown>;
};

async function waitForOffer(request: APIRequestContext, agentToken: string, bookingId: string) {
  for (let i = 0; i < 40; i++) {
    const body = await (await request.get(apiUrl("/agent/offers/current"), { headers: authHeader(agentToken) })).json();
    if (body.data?.bookingId === bookingId) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("agent never received the offer for this booking");
}

async function timeline(request: APIRequestContext, adminToken: string, bookingId: string): Promise<TimelineEntry[]> {
  const res = await request.get(apiUrl(`/admin/bookings/${bookingId}`), { headers: authHeader(adminToken) });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.timeline;
}

async function waitForTimeline(
  request: APIRequestContext,
  adminToken: string,
  bookingId: string,
  done: (t: TimelineEntry[]) => boolean,
): Promise<TimelineEntry[]> {
  let last: TimelineEntry[] = [];
  for (let i = 0; i < 30; i++) {
    last = await timeline(request, adminToken, bookingId);
    if (done(last)) return last;
    await new Promise((r) => setTimeout(r, 200));
  }
  return last;
}

test.describe("Admin booking timeline", () => {
  test("records the whole life of a booking: offers, decline, accept, give-back with reason, admin assign, completion", async ({
    request,
  }) => {
    test.setTimeout(90_000);
    // A spot nobody else is online near, so the two cleaners below are the
    // only candidates and the offer order is deterministic (nearest first).
    const lat = -45 + Math.random() * 5;
    const lng = -140 + Math.random() * 5;
    const agentA = await createVerifiedOnlineAgent(request, { lat, lng });
    const agentB = await createVerifiedOnlineAgent(request, { lat: lat + 0.004, lng });

    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = (await (await request.get(apiUrl("/catalog/packages"))).json()).data[0].id;
    const created = await request.post(apiUrl("/bookings"), {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "hatchback",
        vehicleName: "Timeline Car",
        packageId,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        slot: "11:00 AM",
        addressLabel: "Home",
        addressLine: "1 Timeline Road",
        lat,
        lng,
      },
    });
    expect(created.ok()).toBeTruthy();
    const bookingId: string = (await created.json()).data.id;

    // 1. Nearest cleaner (A) gets it first and declines.
    await waitForOffer(request, agentA.token, bookingId);
    expect((await request.post(apiUrl(`/agent/offers/${bookingId}/decline`), { headers: authHeader(agentA.token) })).ok()).toBeTruthy();

    // 2. Next-nearest (B) gets it and accepts.
    await waitForOffer(request, agentB.token, bookingId);
    expect((await request.post(apiUrl(`/agent/offers/${bookingId}/accept`), { headers: authHeader(agentB.token) })).ok()).toBeTruthy();

    // 3. B can't go after all and gives it back with a reason.
    const reason = "Car broke down on the way";
    const release = await request.post(apiUrl(`/agent/jobs/${bookingId}/release`), {
      headers: authHeader(agentB.token),
      data: { reason },
    });
    expect(release.ok(), await release.text()).toBeTruthy();

    // With A (declined) and B (gave it back) both excluded, nobody's left → admin queue.
    const { token: adminToken } = await loginAsAdmin(request);
    await waitForTimeline(request, adminToken, bookingId, (t) => t.some((e) => e.type === "admin_queue"));

    // 4. An admin assigns A by hand.
    const assign = await request.patch(apiUrl(`/admin/bookings/${bookingId}/assign`), {
      headers: authHeader(adminToken),
      data: { agentId: agentA.userId },
    });
    expect(assign.ok(), await assign.text()).toBeTruthy();

    // 5. A does the job.
    for (const kind of ["before", "after"] as const) {
      for (let i = 0; i < 4; i++) {
        await request.post(apiUrl(`/agent/jobs/${bookingId}/photo`), {
          headers: authHeader(agentA.token),
          data: { kind, image: TINY_PNG },
        });
      }
    }
    for (let i = 0; i < 4; i++) {
      const res = await request.patch(apiUrl(`/agent/jobs/${bookingId}/advance`), { headers: authHeader(agentA.token) });
      expect(res.ok(), await res.text()).toBeTruthy();
    }

    const t = await waitForTimeline(request, adminToken, bookingId, (x) => x.some((e) => e.type === "completed"));
    const types = t.map((e) => e.type);

    // The full story, in order.
    const expectedOrder = [
      "created",
      "searching",
      "offered",
      "declined",
      "offered",
      "accepted",
      "released",
      "admin_queue",
      "assigned",
      "enroute",
      "arrived",
      "started",
      "completed",
    ];
    let cursor = -1;
    for (const step of expectedOrder) {
      const next = types.indexOf(step, cursor + 1);
      expect(next, `"${step}" missing or out of order in ${types.join(" → ")}`).toBeGreaterThan(cursor);
      cursor = next;
    }

    // Every entry is dated and in chronological order.
    for (let i = 1; i < t.length; i++) {
      expect(t[i].at).not.toBeNull();
      expect(Date.parse(t[i].at!)).toBeGreaterThanOrEqual(Date.parse(t[i - 1].at!));
    }

    // Who did what — each cleaner step names the right cleaner (for the deep link).
    const offers = t.filter((e) => e.type === "offered");
    expect(offers[0].agent?.id).toBe(agentA.userId);
    expect(offers[1].agent?.id).toBe(agentB.userId);
    expect(typeof offers[0].meta?.distanceM).toBe("number");
    expect(t.find((e) => e.type === "declined")?.agent?.id).toBe(agentA.userId);
    expect(t.find((e) => e.type === "accepted")?.agent?.id).toBe(agentB.userId);

    const released = t.find((e) => e.type === "released")!;
    expect(released.agent?.id).toBe(agentB.userId);
    expect(released.reason).toBe(reason);

    const assigned = t.find((e) => e.type === "assigned")!;
    expect(assigned.agent?.id).toBe(agentA.userId);
    expect(assigned.actor).toBe("admin");
    expect(assigned.actorName).not.toBe("");

    expect(t.find((e) => e.type === "completed")?.agent?.id).toBe(agentA.userId);
    expect(t.find((e) => e.type === "created")?.actor).toBe("customer");
  });

  test("an unanswered offer is logged as no response, and cancellation is logged", async ({ request }) => {
    test.setTimeout(90_000);
    const lat = -35 + Math.random() * 5;
    const lng = -130 + Math.random() * 5;
    const agent = await createVerifiedOnlineAgent(request, { lat, lng });
    const { token: adminToken } = await loginAsAdmin(request);

    // Shortest offer timer so the test doesn't wait long for it to run out.
    const original = (await (await request.get(apiUrl("/admin/dispatch/config"), { headers: authHeader(adminToken) })).json()).data;
    const minTimer = await request.put(apiUrl("/admin/dispatch/config"), {
      headers: authHeader(adminToken),
      data: { offerTimeoutSeconds: 10 },
    });
    try {
      expect(minTimer.ok(), await minTimer.text()).toBeTruthy();
      const { token: customerToken } = await loginAsNewCustomer(request);
      const packageId = (await (await request.get(apiUrl("/catalog/packages"))).json()).data[0].id;
      const created = await request.post(apiUrl("/bookings"), {
        headers: authHeader(customerToken),
        data: {
          vehicleType: "hatchback",
          vehicleName: "Ignored Car",
          packageId,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          slot: "11:00 AM",
          addressLabel: "Home",
          addressLine: "2 Timeline Road",
          lat,
          lng,
        },
      });
      const bookingId: string = (await created.json()).data.id;
      await waitForOffer(request, agent.token, bookingId);

      // Ignore it; the sweep times it out.
      let t: TimelineEntry[] = [];
      for (let i = 0; i < 40 && !t.some((e) => e.type === "offer_expired"); i++) {
        await new Promise((r) => setTimeout(r, 500));
        t = await timeline(request, adminToken, bookingId);
      }
      expect(t.find((e) => e.type === "offer_expired")?.agent?.id).toBe(agent.userId);

      const cancel = await request.patch(apiUrl(`/bookings/${bookingId}/cancel`), { headers: authHeader(customerToken) });
      expect(cancel.ok(), await cancel.text()).toBeTruthy();
      t = await waitForTimeline(request, adminToken, bookingId, (x) => x.some((e) => e.type === "cancelled"));
      expect(t.find((e) => e.type === "cancelled")?.actor).toBe("customer");
    } finally {
      if (original?.offerTimeoutSeconds) {
        await request.put(apiUrl("/admin/dispatch/config"), {
          headers: authHeader(adminToken),
          data: { offerTimeoutSeconds: original.offerTimeoutSeconds },
        });
      }
    }
  });
});

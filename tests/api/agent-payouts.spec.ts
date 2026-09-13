import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import { authHeader, loginAsAdmin, loginAsAgent, loginAsNewCustomer } from "../fixtures/api-client";

/** 1x1 transparent PNG — the smallest thing the upload path accepts. */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * The cleaner's cut used to be a hardcoded `price * 0.7` in four separate
 * places. It is now a single admin-managed rule (Admin → Finance → Agent
 * Payouts); these cover the rule itself, the guardrails on it, and the promise
 * that editing it never re-prices work an agent has already finished.
 */

const DEFAULT_RULE = { mode: "percent", percent: 70, flatAmount: 0, minPayout: 0, maxPayout: 0 };

async function setRule(request: APIRequestContext, adminToken: string, patch: Record<string, unknown>) {
  const res = await request.put("/admin/payout-config", { headers: authHeader(adminToken), data: patch });
  expect(res.ok(), `payout-config update rejected: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

/** Creates a booking for a fresh customer and pins it to the seeded agent. */
async function seedAssignedJob(request: APIRequestContext, adminToken: string, agentId: string) {
  const { token: customerToken } = await loginAsNewCustomer(request);
  const packages = (await (await request.get("/catalog/packages")).json()).data;
  const created = await (
    await request.post("/bookings", {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "hatchback",
        vehicleName: "Payout Test Car",
        packageId: packages[0].id,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        slot: "11:00 AM",
        addressLabel: "Home",
        addressLine: "123 Payout Street",
      },
    })
  ).json();
  const bookingId = created.data.id;

  const assign = await request.patch(`/admin/bookings/${bookingId}/assign`, {
    headers: authHeader(adminToken),
    data: { agentId },
  });
  expect(assign.ok(), `assign failed: ${await assign.text()}`).toBeTruthy();
  return bookingId;
}

async function jobById(request: APIRequestContext, agentToken: string, bookingId: string) {
  const jobs = (await (await request.get("/agent/jobs", { headers: authHeader(agentToken) })).json()).data as Array<{
    id: string;
    price: number;
    payout: number;
    status: string;
  }>;
  const job = jobs.find((j) => j.id === bookingId);
  expect(job, "seeded job missing from the agent's job list").toBeTruthy();
  return job!;
}

/** Walks a job all the way to completed, satisfying the photo gate on the way. */
async function completeJob(request: APIRequestContext, agentToken: string, bookingId: string) {
  // Completing a job now requires four real photos per side — an image-less
  // POST no longer flips hasBefore/hasAfter, because that flag is derived from
  // the stored array. Four tiny PNGs is the cheapest way to satisfy it.
  for (const kind of ["before", "after"] as const) {
    for (let i = 0; i < 4; i++) {
      await request.post(`/agent/jobs/${bookingId}/photo`, {
        headers: authHeader(agentToken),
        data: { kind, image: TINY_PNG },
      });
    }
  }
  for (let i = 0; i < 5; i++) {
    const res = await request.patch(`/agent/jobs/${bookingId}/advance`, { headers: authHeader(agentToken) });
    const body = await res.json();
    if (body.data?.status === "completed") return body.data as { payout: number };
  }
  throw new Error("job never reached completed");
}

test.describe("Agent payout rule", () => {
  // Every test edits one global document, so put it back afterwards rather than
  // leaving an odd rate behind for whatever spec runs next.
  test.afterEach(async ({ request }) => {
    const { token } = await loginAsAdmin(request);
    await setRule(request, token, DEFAULT_RULE);
  });

  test("defaults to the historical 70% split", async ({ request }) => {
    const { token } = await loginAsAdmin(request);
    await setRule(request, token, DEFAULT_RULE);

    const res = await request.get("/admin/payout-config", { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data).toMatchObject(DEFAULT_RULE);
  });

  test("an open job is quoted at the current percentage, and re-quoted when it changes", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const { token: agentToken, userId: agentId } = await loginAsAgent(request);
    await setRule(request, adminToken, DEFAULT_RULE);

    const bookingId = await seedAssignedJob(request, adminToken, agentId);
    const atSeventy = await jobById(request, agentToken, bookingId);
    expect(atSeventy.payout).toBe(Math.round(atSeventy.price * 0.7));

    await setRule(request, adminToken, { mode: "percent", percent: 50 });
    const atFifty = await jobById(request, agentToken, bookingId);
    expect(atFifty.payout).toBe(Math.round(atFifty.price * 0.5));
  });

  test("a flat rule pays the same on every job, and the floor and cap clamp it", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const { token: agentToken, userId: agentId } = await loginAsAgent(request);
    const bookingId = await seedAssignedJob(request, adminToken, agentId);

    // Amounts are derived from the seeded package price so this doesn't break
    // the next time someone edits the price catalog.
    const { price } = await jobById(request, agentToken, bookingId);
    const flat = Math.round(price * 0.4);
    const floor = Math.round(price * 0.6);
    const cap = Math.round(price * 0.2);

    await setRule(request, adminToken, { mode: "flat", flatAmount: flat, minPayout: 0, maxPayout: 0 });
    expect((await jobById(request, agentToken, bookingId)).payout).toBe(flat);

    // A floor above the flat amount wins.
    await setRule(request, adminToken, { minPayout: floor });
    expect((await jobById(request, agentToken, bookingId)).payout).toBe(floor);

    // A cap below it wins in the other direction.
    await setRule(request, adminToken, { minPayout: 0, maxPayout: cap });
    expect((await jobById(request, agentToken, bookingId)).payout).toBe(cap);
  });

  test("a payout never exceeds the price the job was sold for", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const { token: agentToken, userId: agentId } = await loginAsAgent(request);
    const bookingId = await seedAssignedJob(request, adminToken, agentId);
    const { price } = await jobById(request, agentToken, bookingId);

    await setRule(request, adminToken, { mode: "flat", flatAmount: price + 5000, minPayout: 0, maxPayout: 0 });
    expect((await jobById(request, agentToken, bookingId)).payout).toBe(Math.round(price));
  });

  test("completed earnings are frozen — changing the rule later does not rewrite them", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const { token: agentToken, userId: agentId } = await loginAsAgent(request);

    await setRule(request, adminToken, { mode: "percent", percent: 70, flatAmount: 0, minPayout: 0, maxPayout: 0 });
    const bookingId = await seedAssignedJob(request, adminToken, agentId);
    const completed = await completeJob(request, agentToken, bookingId);
    const earnedAtCompletion = completed.payout;
    expect(earnedAtCompletion).toBeGreaterThan(0);

    // Halve the rate afterwards. The finished job must still report what the
    // agent was told they earned.
    await setRule(request, adminToken, { mode: "percent", percent: 20 });
    const afterChange = await jobById(request, agentToken, bookingId);
    expect(afterChange.status).toBe("completed");
    expect(afterChange.payout).toBe(earnedAtCompletion);
  });

  test("rejects rules that would silently zero out or invert cleaner earnings", async ({ request }) => {
    const { token } = await loginAsAdmin(request);
    await setRule(request, token, DEFAULT_RULE);

    const flatWithNoAmount = await request.put("/admin/payout-config", {
      headers: authHeader(token),
      data: { mode: "flat", flatAmount: 0 },
    });
    expect(flatWithNoAmount.status()).toBe(400);

    const zeroPercent = await request.put("/admin/payout-config", {
      headers: authHeader(token),
      data: { mode: "percent", percent: 0 },
    });
    expect(zeroPercent.status()).toBe(400);

    const overHundred = await request.put("/admin/payout-config", {
      headers: authHeader(token),
      data: { percent: 140 },
    });
    expect(overHundred.status()).toBe(400);

    const capBelowFloor = await request.put("/admin/payout-config", {
      headers: authHeader(token),
      data: { minPayout: 300, maxPayout: 100 },
    });
    expect(capBelowFloor.status()).toBe(400);
  });

  test("only admins can read or change the rule", async ({ request }) => {
    const { token: agentToken } = await loginAsAgent(request);
    const { token: customerToken } = await loginAsNewCustomer(request);

    for (const token of [agentToken, customerToken]) {
      const read = await request.get("/admin/payout-config", { headers: authHeader(token) });
      expect(read.status()).toBe(403);
      const write = await request.put("/admin/payout-config", {
        headers: authHeader(token),
        data: { mode: "flat", flatAmount: 9999 },
      });
      expect(write.status()).toBe(403);
    }

    const anonymous = await request.get("/admin/payout-config");
    expect(anonymous.status()).toBe(401);
  });
});

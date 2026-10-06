import { test, expect } from "../fixtures/base";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  apiUrl,
  authHeader,
  createVerifiedOnlineAgent,
  loginAsAdmin,
  loginAsNewCustomer,
} from "../fixtures/api-client";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

type Agent = { token: string; userId: string };

/** A cleaner online alone at a random remote spot, so every booking there goes to them. */
async function isolatedAgent(request: APIRequestContext) {
  const lat = -15 + Math.random() * 5;
  const lng = -110 + Math.random() * 5;
  const agent = await createVerifiedOnlineAgent(request, { lat, lng });
  return { agent, lat, lng };
}

async function bookAt(request: APIRequestContext, customerToken: string, lat: number, lng: number) {
  const packageId = (await (await request.get(apiUrl("/catalog/packages"))).json()).data[0].id;
  const res = await request.post(apiUrl("/bookings"), {
    headers: authHeader(customerToken),
    data: {
      vehicleType: "hatchback",
      vehicleName: "Review Car",
      packageId,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      slot: "11:00 AM",
      addressLabel: "Home",
      addressLine: "5 Review Road",
      lat,
      lng,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data.id as string;
}

async function acceptAndComplete(request: APIRequestContext, agent: Agent, bookingId: string) {
  for (let i = 0; i < 40; i++) {
    const body = await (await request.get(apiUrl("/agent/offers/current"), { headers: authHeader(agent.token) })).json();
    if (body.data?.bookingId === bookingId) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const accept = await request.post(apiUrl(`/agent/offers/${bookingId}/accept`), { headers: authHeader(agent.token) });
  expect(accept.ok(), await accept.text()).toBeTruthy();
  for (const kind of ["before", "after"] as const) {
    for (let i = 0; i < 4; i++) {
      await request.post(apiUrl(`/agent/jobs/${bookingId}/photo`), {
        headers: authHeader(agent.token),
        data: { kind, image: TINY_PNG },
      });
    }
  }
  for (let i = 0; i < 4; i++) {
    const res = await request.patch(apiUrl(`/agent/jobs/${bookingId}/advance`), { headers: authHeader(agent.token) });
    expect(res.ok(), await res.text()).toBeTruthy();
  }
}

test.describe("Ratings & reviews", () => {
  test("customer rates a completed booking; agent rating, agent/admin views, booking detail and timeline all reflect it", async ({
    request,
  }) => {
    test.setTimeout(90_000);
    const { agent, lat, lng } = await isolatedAgent(request);
    const { token: customerToken } = await loginAsNewCustomer(request);

    // Two jobs for the same cleaner, rated 5 and 4 → average 4.5.
    const first = await bookAt(request, customerToken, lat, lng);
    await acceptAndComplete(request, agent, first);
    const second = await bookAt(request, customerToken, lat, lng);
    await acceptAndComplete(request, agent, second);

    // Booking detail before rating: completed, has the cleaner and photos, no review.
    const before = (await (await request.get(apiUrl(`/bookings/${first}`), { headers: authHeader(customerToken) })).json()).data;
    expect(before.status).toBe("completed");
    expect(before.review).toBeNull();
    expect(before.agent.id).toBe(agent.userId);
    expect(before.beforePhotos.length).toBe(4);
    expect(before.afterPhotos.length).toBe(4);

    const r1 = await request.post(apiUrl(`/bookings/${first}/review`), {
      headers: authHeader(customerToken),
      data: { rating: 5, comment: "  Spotless work, very polite!  " },
    });
    expect(r1.status(), await r1.text()).toBe(201);
    expect((await r1.json()).data).toMatchObject({ rating: 5, comment: "Spotless work, very polite!", agentId: agent.userId });

    const r2 = await request.post(apiUrl(`/bookings/${second}/review`), {
      headers: authHeader(customerToken),
      data: { rating: 4 },
    });
    expect(r2.status()).toBe(201);

    // One review per booking.
    const again = await request.post(apiUrl(`/bookings/${first}/review`), {
      headers: authHeader(customerToken),
      data: { rating: 1 },
    });
    expect(again.status()).toBe(409);

    // Customer list + detail show it.
    const list = (await (await request.get(apiUrl("/bookings"), { headers: authHeader(customerToken) })).json()).data;
    expect(list.find((b: { id: string }) => b.id === first).review.rating).toBe(5);
    const after = (await (await request.get(apiUrl(`/bookings/${first}`), { headers: authHeader(customerToken) })).json()).data;
    expect(after.review.comment).toBe("Spotless work, very polite!");
    expect(after.agent).toMatchObject({ rating: 4.5, ratingCount: 2 });

    // The cleaner sees their average, breakdown and reviews (customer name shortened).
    const mine = (await (await request.get(apiUrl("/agent/reviews"), { headers: authHeader(agent.token) })).json()).data;
    expect(mine).toMatchObject({ rating: 4.5, ratingCount: 2, breakdown: { "5": 1, "4": 1, "3": 0, "2": 0, "1": 0 } });
    expect(mine.reviews).toHaveLength(2);
    expect(mine.reviews.map((r: { bookingId: string }) => r.bookingId).sort()).toEqual([first, second].sort());
    const me = (await (await request.get(apiUrl("/auth/me"), { headers: authHeader(agent.token) })).json()).data;
    expect(me.rating).toBe(4.5);
    expect(me.ratingCount).toBe(2);
    // ...and got an in-app notification about it.
    const notes = (await (await request.get(apiUrl("/notifications"), { headers: authHeader(agent.token) })).json()).data;
    expect(notes.some((n: { title: string }) => /New \d-star review/.test(n.title))).toBe(true);

    // Admin: cleaner reviews, per-booking rating in service history, booking review + timeline.
    const { token: adminToken } = await loginAsAdmin(request);
    const adminReviews = (await (await request.get(apiUrl(`/admin/agents/${agent.userId}/reviews`), { headers: authHeader(adminToken) })).json()).data;
    expect(adminReviews.ratingCount).toBe(2);
    expect(adminReviews.reviews[0].customerName).not.toBe("");
    const activity = (await (await request.get(apiUrl(`/admin/agents/${agent.userId}/activity`), { headers: authHeader(adminToken) })).json()).data;
    expect(activity.bookings.find((b: { id: string }) => b.id === first).rating).toBe(5);
    expect(activity.bookings.find((b: { id: string }) => b.id === second).rating).toBe(4);
    const detail = (await (await request.get(apiUrl(`/admin/bookings/${first}`), { headers: authHeader(adminToken) })).json()).data;
    expect(detail.review).toMatchObject({ rating: 5, comment: "Spotless work, very polite!" });
    const reviewed = detail.timeline.find((e: { type: string }) => e.type === "reviewed");
    expect(reviewed).toMatchObject({ actor: "customer", reason: "Spotless work, very polite!", meta: { rating: 5 } });
    expect(reviewed.agent.id).toBe(agent.userId);
    const agentRow = (await (await request.get(apiUrl(`/admin/agents/${agent.userId}`), { headers: authHeader(adminToken) })).json()).data;
    expect(agentRow).toMatchObject({ rating: 4.5, ratingCount: 2 });
  });

  test("refuses reviews that aren't allowed", async ({ request }) => {
    test.setTimeout(60_000);
    const { agent, lat, lng } = await isolatedAgent(request);
    const { token: customerToken } = await loginAsNewCustomer(request);
    const { token: otherCustomer } = await loginAsNewCustomer(request);

    // Not completed yet.
    const upcoming = await bookAt(request, customerToken, lat, lng);
    const early = await request.post(apiUrl(`/bookings/${upcoming}/review`), {
      headers: authHeader(customerToken),
      data: { rating: 5 },
    });
    expect(early.status()).toBe(400);

    await acceptAndComplete(request, agent, upcoming);

    // Someone else's booking.
    const notMine = await request.post(apiUrl(`/bookings/${upcoming}/review`), {
      headers: authHeader(otherCustomer),
      data: { rating: 5 },
    });
    expect(notMine.status()).toBe(404);
    expect((await request.get(apiUrl(`/bookings/${upcoming}`), { headers: authHeader(otherCustomer) })).status()).toBe(404);

    // Bad input.
    for (const data of [{ rating: 0 }, { rating: 6 }, { rating: 3.5 }, {}, { rating: 4, comment: "x".repeat(501) }]) {
      const res = await request.post(apiUrl(`/bookings/${upcoming}/review`), { headers: authHeader(customerToken), data });
      expect(res.status(), JSON.stringify(data)).toBe(400);
    }

    // Unauthenticated — a fresh context, since the shared one carries the last login's session cookie.
    const anon = await pwRequest.newContext();
    expect((await anon.post(apiUrl(`/bookings/${upcoming}/review`), { data: { rating: 5 } })).status()).toBe(401);
    await anon.dispose();

    // Still reviewable after all those refusals.
    const okRes = await request.post(apiUrl(`/bookings/${upcoming}/review`), {
      headers: authHeader(customerToken),
      data: { rating: 3 },
    });
    expect(okRes.status()).toBe(201);
  });

  test("a cleaner with no reviews reports zero, and only agents can read /agent/reviews", async ({ request }) => {
    const { agent } = await isolatedAgent(request);
    const mine = (await (await request.get(apiUrl("/agent/reviews"), { headers: authHeader(agent.token) })).json()).data;
    expect(mine.ratingCount).toBe(0);
    expect(mine.reviews).toEqual([]);
    const { token: customerToken } = await loginAsNewCustomer(request);
    expect((await request.get(apiUrl("/agent/reviews"), { headers: authHeader(customerToken) })).status()).toBe(403);
  });
});

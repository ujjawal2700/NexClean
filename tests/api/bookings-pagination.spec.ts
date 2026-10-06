import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import { apiUrl, authHeader, loginAsNewCustomer } from "../fixtures/api-client";

async function makeBookings(request: APIRequestContext, token: string, n: number): Promise<string[]> {
  const packageId = (await (await request.get(apiUrl("/catalog/packages"))).json()).data[0].id;
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const res = await request.post(apiUrl("/bookings"), {
      headers: authHeader(token),
      data: {
        vehicleType: "hatchback",
        vehicleName: `Paged Car ${i}`,
        packageId,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        slot: "11:00 AM",
        addressLabel: "Home",
        addressLine: "9 Page Street",
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    ids.push((await res.json()).data.id);
  }
  return ids;
}

async function getPage(request: APIRequestContext, token: string, query: string) {
  const res = await request.get(apiUrl(`/bookings?${query}`), { headers: authHeader(token) });
  return { status: res.status(), body: (await res.json()).data };
}

test.describe("My bookings pagination", () => {
  test("pages through the history newest first, filters by status on the server, and reports counts", async ({ request }) => {
    test.setTimeout(90_000);
    const { token } = await loginAsNewCustomer(request);
    const ids = await makeBookings(request, token, 13);
    // Cancel the 3 oldest.
    for (const id of ids.slice(0, 3)) {
      expect((await request.patch(apiUrl(`/bookings/${id}/cancel`), { headers: authHeader(token) })).ok()).toBeTruthy();
    }

    const p1 = await getPage(request, token, "page=1&limit=10");
    expect(p1.status).toBe(200);
    expect(p1.body.items).toHaveLength(10);
    expect(p1.body).toMatchObject({ page: 1, limit: 10, total: 13, hasMore: true });
    expect(p1.body.counts).toEqual({ all: 13, upcoming: 10, completed: 0, cancelled: 3 });
    // Newest first.
    expect(p1.body.items[0].id).toBe(ids[12]);

    const p2 = await getPage(request, token, "page=2&limit=10");
    expect(p2.body.items).toHaveLength(3);
    expect(p2.body.hasMore).toBe(false);
    // No overlap, nothing missing.
    const seen = [...p1.body.items, ...p2.body.items].map((b: { id: string }) => b.id);
    expect(new Set(seen).size).toBe(13);
    expect(seen.sort()).toEqual([...ids].sort());

    const cancelled = await getPage(request, token, "page=1&limit=10&status=cancelled");
    expect(cancelled.body.items).toHaveLength(3);
    expect(cancelled.body.total).toBe(3);
    expect(cancelled.body.items.every((b: { status: string }) => b.status === "cancelled")).toBe(true);

    const upcoming = await getPage(request, token, "page=2&limit=5&status=upcoming");
    expect(upcoming.body.items).toHaveLength(5);
    expect(upcoming.body.hasMore).toBe(false);

    // Beyond the end is an empty page, not an error.
    const beyond = await getPage(request, token, "page=9&limit=10");
    expect(beyond.body.items).toEqual([]);
    expect(beyond.body.hasMore).toBe(false);
  });

  test("rejects bad paging params", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    for (const q of ["page=0", "page=-1", "page=abc", "page=1&limit=0", "page=1&limit=51", "page=1&status=done"]) {
      expect((await getPage(request, token, q)).status, q).toBe(400);
    }
  });

  test("the unpaged list is bounded: every upcoming booking plus the 20 most recent others", async ({ request }) => {
    test.setTimeout(120_000);
    const { token } = await loginAsNewCustomer(request);
    const ids = await makeBookings(request, token, 24);
    // 22 cancelled, 2 still upcoming (the two oldest, so they'd fall off a plain "latest 20").
    for (const id of ids.slice(2)) {
      expect((await request.patch(apiUrl(`/bookings/${id}/cancel`), { headers: authHeader(token) })).ok()).toBeTruthy();
    }
    const res = await request.get(apiUrl("/bookings"), { headers: authHeader(token) });
    const list = (await res.json()).data as { id: string; status: string }[];
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(22);
    expect(list.filter((b) => b.status === "upcoming").map((b) => b.id).sort()).toEqual(ids.slice(0, 2).sort());
    expect(list.filter((b) => b.status === "cancelled")).toHaveLength(20);
  });
});

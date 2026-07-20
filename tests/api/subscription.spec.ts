import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import { authHeader, loginAsNewCustomer } from "../fixtures/api-client";

async function firstPlanId(request: APIRequestContext): Promise<string> {
  const body = await (await request.get("/catalog/plans")).json();
  return body.data[0].id;
}

test.describe("Subscription", () => {
  test("preview requires auth", async ({ request }) => {
    const res = await request.post("/subscriptions/preview", { data: { planId: "x" } });
    expect(res.status()).toBe(401);
  });

  test("preview rejects an unknown plan", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.post("/subscriptions/preview", {
      headers: authHeader(token),
      data: { planId: "000000000000000000000000" },
    });
    expect(res.status()).toBe(400);
  });

  test("preview computes a price for a real plan", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const planId = await firstPlanId(request);
    const res = await request.post("/subscriptions/preview", { headers: authHeader(token), data: { planId } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.price).toBeGreaterThan(0);
  });

  test("schedule is empty with no active plan", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.get("/subscriptions/schedule", { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.activePlan).toBeNull();
    expect(body.data.bookings).toEqual([]);
  });

  test("unsubscribe with no active plan doesn't 500", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.delete("/subscriptions", { headers: authHeader(token) });
    expect(res.status()).toBeLessThan(500);
  });
});

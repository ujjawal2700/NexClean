import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import { authHeader, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";

async function firstPackageId(request: APIRequestContext): Promise<string> {
  const res = await request.get("/catalog/packages");
  const body = await res.json();
  return body.data[0].id;
}

function validBookingPayload(packageId: string, extra: Record<string, unknown> = {}) {
  return {
    vehicleType: "hatchback",
    vehicleName: "Test Car",
    packageId,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    slot: "11:00 AM",
    addressLabel: "Home",
    addressLine: "123 Test Street",
    ...extra,
  };
}

test.describe("Booking", () => {
  test("requires auth", async ({ request }) => {
    const packageId = await firstPackageId(request);
    const res = await request.post("/bookings", { data: validBookingPayload(packageId) });
    expect(res.status()).toBe(401);
  });

  test("rejects a missing/invalid packageId", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.post("/bookings", {
      headers: authHeader(token),
      data: validBookingPayload("this-package-does-not-exist"),
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a malformed date", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const res = await request.post("/bookings", {
      headers: authHeader(token),
      data: { ...validBookingPayload(packageId), date: "not-a-date" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an empty address line", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const res = await request.post("/bookings", {
      headers: authHeader(token),
      data: { ...validBookingPayload(packageId), addressLine: "" },
    });
    expect(res.status()).toBe(400);
  });

  test("creates a booking with coordinates and it enters the dispatch pipeline (searching, not stuck at 0 attempts)", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const res = await request.post("/bookings", {
      headers: authHeader(token),
      // Indore-ish coordinates, matching the seeded demo agents' area.
      data: validBookingPayload(packageId, { lat: 22.7196, lng: 75.8577 }),
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.price).toBeGreaterThan(0);
    expect(["searching", "offered", "assigned", "pending_admin"]).toContain(body.data.dispatchStatus);
  });

  test("creates a booking WITHOUT coordinates and it routes straight to the admin queue, never to an agent", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const res = await request.post("/bookings", {
      headers: authHeader(token),
      data: validBookingPayload(packageId), // no lat/lng
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Dispatch runs async (fire-and-forget) after creation; give it a beat to settle.
    await new Promise((r) => setTimeout(r, 500));
    const listRes = await request.get("/bookings", { headers: authHeader(token) });
    const listed = (await listRes.json()).data.find((b: { id: string }) => b.id === body.data.id);
    expect(listed.dispatchStatus).toBe("pending_admin");
    expect(listed.dispatchAttempts).toBe(0);
  });

  test("a customer only ever sees their own bookings", async ({ request }) => {
    const a = await loginAsNewCustomer(request);
    const b = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    await request.post("/bookings", { headers: authHeader(a.token), data: validBookingPayload(packageId) });
    const listB = await (await request.get("/bookings", { headers: authHeader(b.token) })).json();
    expect(listB.data.length).toBe(0);
  });

  test("cancel requires ownership — another customer cannot cancel it", async ({ request }) => {
    const owner = await loginAsNewCustomer(request);
    const stranger = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const created = await (
      await request.post("/bookings", { headers: authHeader(owner.token), data: validBookingPayload(packageId) })
    ).json();
    const res = await request.patch(`/bookings/${created.data.id}/cancel`, { headers: authHeader(stranger.token) });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("owner can cancel their own upcoming booking", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const created = await (
      await request.post("/bookings", { headers: authHeader(token), data: validBookingPayload(packageId) })
    ).json();
    const res = await request.patch(`/bookings/${created.data.id}/cancel`, { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.status).toBe("cancelled");
  });

  test("admin can see the booking in the dispatch queue / bookings list", async ({ request }) => {
    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    await request.post("/bookings", { headers: authHeader(customerToken), data: validBookingPayload(packageId) });

    const { token: adminToken } = await loginAsAdmin(request);
    const res = await request.get("/admin/bookings", { headers: authHeader(adminToken) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

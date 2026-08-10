import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader } from "../fixtures/api-client";
import { apiUrl, loginAsNewCustomerApi } from "../fixtures/admin-api-helpers";

async function firstPackageId(request: APIRequestContext): Promise<string> {
  const body = await (await request.get(apiUrl("/catalog/packages"))).json();
  return body.data[0].id;
}

/** Creating a booking synchronously fires a "✅ Booking confirmed" notification (see backend/src/modules/booking/booking.service.ts). */
async function createBookingNotification(request: APIRequestContext, token: string): Promise<void> {
  const packageId = await firstPackageId(request);
  const res = await request.post(apiUrl("/bookings"), {
    headers: authHeader(token),
    data: {
      vehicleType: "hatchback",
      vehicleName: "Test Car",
      packageId,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      slot: "11:00 AM",
      addressLabel: "Home",
      addressLine: "123 Test Street",
    },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Notifications", () => {
  test.describe("register-token", () => {
    test("requires auth", async ({ request }) => {
      const res = await request.post(apiUrl("/notifications/register-token"), { data: { token: "a-valid-device-token" } });
      expect(res.status()).toBe(401);
    });

    test("rejects a token under 8 chars", async ({ request }) => {
      const { token } = await loginAsNewCustomerApi(request);
      const res = await request.post(apiUrl("/notifications/register-token"), {
        headers: authHeader(token),
        data: { token: "short" },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("A valid device token is required");
    });

    test("registers a valid token and returns {registered:true}", async ({ request }) => {
      const { token } = await loginAsNewCustomerApi(request);
      const res = await request.post(apiUrl("/notifications/register-token"), {
        headers: authHeader(token),
        data: { token: "a-valid-device-token-abc" },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.data).toEqual({ registered: true });
    });

    test("registering the same token twice is idempotent (no duplicate error)", async ({ request }) => {
      const { token } = await loginAsNewCustomerApi(request);
      const deviceToken = "a-valid-device-token-xyz";
      const first = await request.post(apiUrl("/notifications/register-token"), {
        headers: authHeader(token),
        data: { token: deviceToken },
      });
      expect(first.ok()).toBeTruthy();
      const second = await request.post(apiUrl("/notifications/register-token"), {
        headers: authHeader(token),
        data: { token: deviceToken },
      });
      expect(second.ok()).toBeTruthy();
      expect((await second.json()).data).toEqual({ registered: true });
    });
  });

  test.describe("list + read", () => {
    test("requires auth", async ({ request }) => {
      const res = await request.get(apiUrl("/notifications"));
      expect(res.status()).toBe(401);
    });

    test("returns an array, newest first", async ({ request }) => {
      const { token } = await loginAsNewCustomerApi(request);
      // Two bookings → two "Booking confirmed" notifications, second strictly newer.
      await createBookingNotification(request, token);
      await createBookingNotification(request, token);

      const res = await request.get(apiUrl("/notifications"), { headers: authHeader(token) });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      const createdAts = body.data.map((n: { createdAt: string }) => new Date(n.createdAt).getTime());
      const sorted = [...createdAts].sort((a, b) => b - a);
      expect(createdAts).toEqual(sorted);
      expect(body.data.every((n: { read: boolean }) => n.read === false)).toBe(true);
    });

    test("PATCH /notifications/read requires auth", async ({ request }) => {
      const res = await request.patch(apiUrl("/notifications/read"));
      expect(res.status()).toBe(401);
    });

    test("marks all notifications read, and the list reflects it afterwards", async ({ request }) => {
      const { token } = await loginAsNewCustomerApi(request);
      await createBookingNotification(request, token);

      const before = await (await request.get(apiUrl("/notifications"), { headers: authHeader(token) })).json();
      expect(before.data.some((n: { read: boolean }) => n.read === false)).toBe(true);

      const markRead = await request.patch(apiUrl("/notifications/read"), { headers: authHeader(token) });
      expect(markRead.ok()).toBeTruthy();
      const markReadBody = await markRead.json();
      expect(markReadBody.data).toEqual({ ok: true });

      const after = await (await request.get(apiUrl("/notifications"), { headers: authHeader(token) })).json();
      expect(after.data.length).toBeGreaterThan(0);
      expect(after.data.every((n: { read: boolean }) => n.read === true)).toBe(true);
    });

    test("a customer only ever sees their own notifications", async ({ request }) => {
      const a = await loginAsNewCustomerApi(request);
      const b = await loginAsNewCustomerApi(request);
      await createBookingNotification(request, a.token);

      const listB = await (await request.get(apiUrl("/notifications"), { headers: authHeader(b.token) })).json();
      expect(listB.data.length).toBe(0);
    });
  });
});

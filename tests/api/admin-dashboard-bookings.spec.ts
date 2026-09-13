import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader } from "../fixtures/api-client";
import {
  apiUrl,
  loginAsAdminApi,
  loginAsAgentApi,
  loginAsNewCustomerApi,
  loginAsPendingAgentApi,
} from "../fixtures/admin-api-helpers";

async function firstPackageId(request: APIRequestContext): Promise<string> {
  const body = await (await request.get(apiUrl("/catalog/packages"))).json();
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

/** A booking WITHOUT coordinates — routes straight to the admin queue (dispatchStatus "pending_admin"), never offered to an agent. */
async function createUnlocatedBooking(request: APIRequestContext, customerToken: string): Promise<string> {
  const packageId = await firstPackageId(request);
  const res = await request.post(apiUrl("/bookings"), {
    headers: authHeader(customerToken),
    data: validBookingPayload(packageId),
  });
  const body = await res.json();
  return body.data.id as string;
}

/**
 * Role-gating note (previously a documented app bug, now fixed):
 * requireRole() used to run its 403 role check inside requireAuth()'s own
 * try/catch, so a valid token with the wrong role surfaced as
 * 401 "Invalid or expired token" instead of 403. The middleware now reads the
 * token and checks the role as separate steps, so these assert the correct
 * contract: missing/!invalid token → 401, valid token + wrong role → 403.
 */
test.describe("Admin — dashboard & bookings", () => {
  test.describe("403 sample (non-admin callers)", () => {
    test("GET /admin/stats rejects a customer", async ({ request }) => {
      const { token } = await loginAsNewCustomerApi(request);
      const res = await request.get(apiUrl("/admin/stats"), { headers: authHeader(token) });
      expect(res.status()).toBe(403);
    });

    test("GET /admin/bookings rejects an agent", async ({ request }) => {
      const { token } = await loginAsAgentApi(request);
      const res = await request.get(apiUrl("/admin/bookings"), { headers: authHeader(token) });
      expect(res.status()).toBe(403);
    });

    test("GET /admin/stats requires auth entirely (no token at all → 401)", async ({ request }) => {
      const res = await request.get(apiUrl("/admin/stats"));
      expect(res.status()).toBe(401);
    });
  });

  test.describe("dashboard", () => {
    test("GET /admin/stats returns the expected shape", async ({ request }) => {
      const { token } = await loginAsAdminApi(request);
      const res = await request.get(apiUrl("/admin/stats"), { headers: authHeader(token) });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      for (const key of ["revenue", "activeBookings", "activeServices", "totalUsers", "agentsOnline", "agentsTotal", "alertsTriggered"]) {
        expect(typeof body.data[key]).toBe("number");
      }
    });

    test("GET /admin/reports returns the expected sections", async ({ request }) => {
      const { token } = await loginAsAdminApi(request);
      const res = await request.get(apiUrl("/admin/reports"), { headers: authHeader(token) });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body.data.revenueTrend)).toBe(true);
      expect(Array.isArray(body.data.revenueByVehicle)).toBe(true);
      expect(Array.isArray(body.data.topSocieties)).toBe(true);
      expect(Array.isArray(body.data.agentPerformance)).toBe(true);
      expect(typeof body.data.customerRetention.totalCustomers).toBe("number");
    });
  });

  test.describe("bookings", () => {
    test("GET /admin/bookings lists a freshly created booking", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);

      const { token: adminToken } = await loginAsAdminApi(request);
      const res = await request.get(apiUrl("/admin/bookings"), { headers: authHeader(adminToken) });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.data.find((b: { id: string }) => b.id === bookingId)).toBeTruthy();
    });

    test("PATCH /admin/bookings/:id/cancel cancels a booking", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);

      const { token: adminToken } = await loginAsAdminApi(request);
      const res = await request.patch(apiUrl(`/admin/bookings/${bookingId}/cancel`), { headers: authHeader(adminToken) });
      expect(res.ok()).toBeTruthy();
      expect((await res.json()).data.status).toBe("cancelled");
    });

    test("PATCH /admin/bookings/:id/cancel rejects cancelling an already-cancelled booking", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);

      const first = await request.patch(apiUrl(`/admin/bookings/${bookingId}/cancel`), { headers: authHeader(adminToken) });
      expect(first.ok()).toBeTruthy();

      const second = await request.patch(apiUrl(`/admin/bookings/${bookingId}/cancel`), { headers: authHeader(adminToken) });
      expect(second.status()).toBe(400);
    });

    test("PATCH /admin/bookings/:id/status rejects reopening a cancelled booking", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);

      const cancel = await request.patch(apiUrl(`/admin/bookings/${bookingId}/cancel`), { headers: authHeader(adminToken) });
      expect(cancel.ok()).toBeTruthy();

      // A cancelled booking is a dead end: none of upcoming/in_progress/completed
      // — nor cancelling it again through this endpoint — may resurrect it.
      for (const status of ["upcoming", "in_progress", "completed", "cancelled"] as const) {
        const res = await request.patch(apiUrl(`/admin/bookings/${bookingId}/status`), {
          headers: authHeader(adminToken),
          data: { status },
        });
        expect(res.status()).toBe(400);
      }
    });

    test("PATCH /admin/bookings/:id/cancel 404s for an unknown id", async ({ request }) => {
      const { token: adminToken } = await loginAsAdminApi(request);
      const res = await request.patch(apiUrl("/admin/bookings/000000000000000000000000/cancel"), {
        headers: authHeader(adminToken),
      });
      expect(res.status()).toBe(404);
    });

    test("PATCH /admin/bookings/:id/status rejects an invalid enum value", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);

      const res = await request.patch(apiUrl(`/admin/bookings/${bookingId}/status`), {
        headers: authHeader(adminToken),
        data: { status: "not-a-real-status" },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).message).toBe("Invalid status");
    });

    test("PATCH /admin/bookings/:id/status walks upcoming → in_progress → completed → cancelled", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);

      for (const status of ["in_progress", "completed", "cancelled"] as const) {
        const res = await request.patch(apiUrl(`/admin/bookings/${bookingId}/status`), {
          headers: authHeader(adminToken),
          data: { status },
        });
        expect(res.ok()).toBeTruthy();
        expect((await res.json()).data.status).toBe(status);
      }
    });

    test("PATCH /admin/bookings/:id/assign requires an agentId", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);

      const res = await request.patch(apiUrl(`/admin/bookings/${bookingId}/assign`), {
        headers: authHeader(adminToken),
        data: {},
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).message).toBe("Agent is required");
    });

    test("PATCH /admin/bookings/:id/assign 404s for an unknown agent", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);

      const res = await request.patch(apiUrl(`/admin/bookings/${bookingId}/assign`), {
        headers: authHeader(adminToken),
        data: { agentId: "000000000000000000000000" },
      });
      expect(res.status()).toBe(404);
      expect((await res.json()).message).toBe("Agent not found");
    });

    test("PATCH /admin/bookings/:id/assign rejects an unverified (pending) agent", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);
      const { userId: pendingAgentId } = await loginAsPendingAgentApi(request);

      const res = await request.patch(apiUrl(`/admin/bookings/${bookingId}/assign`), {
        headers: authHeader(adminToken),
        data: { agentId: pendingAgentId },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).message).toBe("Agent is not verified");
    });

    test("PATCH /admin/bookings/:id/assign assigns a verified agent", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);
      const { userId: agentId } = await loginAsAgentApi(request);

      const res = await request.patch(apiUrl(`/admin/bookings/${bookingId}/assign`), {
        headers: authHeader(adminToken),
        data: { agentId },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.data.dispatchStatus).toBe("assigned");
      expect(body.data.assignedAgentId).toBe(agentId);
    });

    test("POST /admin/bookings/:id/auto-assign rejects a booking with no saved location", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);

      const res = await request.post(apiUrl(`/admin/bookings/${bookingId}/auto-assign`), {
        headers: authHeader(adminToken),
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).message).toBe("This booking has no saved location to rank cleaners by");
    });

    test("POST /admin/bookings/:id/auto-assign 404s for an unknown booking", async ({ request }) => {
      const { token: adminToken } = await loginAsAdminApi(request);
      const res = await request.post(apiUrl("/admin/bookings/000000000000000000000000/auto-assign"), {
        headers: authHeader(adminToken),
      });
      expect(res.status()).toBe(404);
    });

    // NOTE: a happy-path "auto-assign succeeds" case isn't included here — the
    // moment a booking with coordinates is created, the fire-and-forget
    // dispatch worker (backend/src/modules/dispatch/dispatch.service.ts
    // offerNext()) already races to lock/offer it to the nearest agent within
    // the same widest search radius auto-assign itself uses, so by the time
    // this test's own request reaches the server the outcome is
    // nondeterministic (assigned vs already-locked-elsewhere) against this
    // shared dev DB. The 400 case below (coordinates far from every seeded
    // agent) is deterministic and is what the task brief asks for; the
    // "assign a verified agent" test above already exercises the same
    // underlying assignAgentToBooking() call deterministically.
    test("POST /admin/bookings/:id/auto-assign reports no nearby cleaners for a location far from every seeded agent", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const packageId = await firstPackageId(request);
      const created = await (
        await request.post(apiUrl("/bookings"), {
          headers: authHeader(customerToken),
          // Ladakh — nowhere near the seeded demo agents' Indore-area coordinates, and outside every dispatch search ring.
          data: validBookingPayload(packageId, { lat: 34.1526, lng: 77.5771 }),
        })
      ).json();
      const bookingId = created.data.id;

      const { token: adminToken } = await loginAsAdminApi(request);
      const res = await request.post(apiUrl(`/admin/bookings/${bookingId}/auto-assign`), { headers: authHeader(adminToken) });
      expect(res.status()).toBe(400);
      expect((await res.json()).message).toBe("No available cleaners nearby to auto-assign");
    });

    test("GET /admin/bookings/:id/assignable-agents lists candidates", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);

      const res = await request.get(apiUrl(`/admin/bookings/${bookingId}/assignable-agents`), { headers: authHeader(adminToken) });
      expect(res.ok()).toBeTruthy();
      expect(Array.isArray((await res.json()).data)).toBe(true);
    });

    test("GET /admin/dispatch/queue returns pending/searching/offered bookings", async ({ request }) => {
      const { token: customerToken } = await loginAsNewCustomerApi(request);
      const bookingId = await createUnlocatedBooking(request, customerToken);
      const { token: adminToken } = await loginAsAdminApi(request);

      const res = await request.get(apiUrl("/admin/dispatch/queue"), { headers: authHeader(adminToken) });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.data.find((b: { id: string }) => b.id === bookingId)).toBeTruthy();
    });
  });
});

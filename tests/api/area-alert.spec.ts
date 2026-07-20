import { test, expect } from "@playwright/test";
import { authHeader } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi, loginAsAgentApi, loginAsNewCustomerApi } from "../fixtures/admin-api-helpers";

/**
 * KNOWN APP BUG (backend/src/shared/middleware/auth.ts:8-33): requireRole()
 * calls requireAuth(req, res, callback), and that callback (which does the
 * actual role check and throws ApiError.forbidden(403) on mismatch) runs
 * *inside* requireAuth's own try block — so its 403 throw is caught by
 * requireAuth's `catch { throw ApiError.unauthorized(...) }` and reported as
 * 401 "Invalid or expired token" instead of 403. Reproduced directly via
 * curl: a syntactically-valid customer JWT that works fine against
 * GET /auth/me (200) and GET /bookings (200) gets a 401 "Invalid or expired
 * token" body from GET /area-alerts/settings and GET /admin/stats (routes
 * gated by requireRole) purely because the role doesn't match — never a 403.
 * The tests below assert the CORRECT (403) behavior per the API contract
 * documented in this task, so they currently fail and document the bug
 * rather than silently passing on the wrong status code.
 */
test.describe("Area alerts", () => {
  test.describe("settings", () => {
    test("GET /area-alerts/settings requires admin auth", async ({ request }) => {
      const res = await request.get(apiUrl("/area-alerts/settings"));
      expect(res.status()).toBe(401);
    });

    test("GET /area-alerts/settings rejects a non-admin (customer) caller [BUG: returns 401, see file header]", async ({ request }) => {
      const { token } = await loginAsNewCustomerApi(request);
      const res = await request.get(apiUrl("/area-alerts/settings"), { headers: authHeader(token) });
      expect(res.status()).toBe(403);
    });

    test("admin can read settings", async ({ request }) => {
      const { token } = await loginAsAdminApi(request);
      const res = await request.get(apiUrl("/area-alerts/settings"), { headers: authHeader(token) });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(typeof body.data.enabled).toBe("boolean");
      expect(typeof body.data.radiusKm).toBe("number");
    });

    test("admin can update settings within valid ranges", async ({ request }) => {
      const { token } = await loginAsAdminApi(request);
      const res = await request.put(apiUrl("/area-alerts/settings"), {
        headers: authHeader(token),
        data: { enabled: true, radiusKm: 2.5, windowMinutes: 30, title: "Nearby!", body: "We're in {{society}} now." },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.data.radiusKm).toBe(2.5);
      expect(body.data.windowMinutes).toBe(30);
      expect(body.data.enabled).toBe(true);
    });

    test("rejects an out-of-range radiusKm", async ({ request }) => {
      const { token } = await loginAsAdminApi(request);
      const res = await request.put(apiUrl("/area-alerts/settings"), {
        headers: authHeader(token),
        data: { radiusKm: 50 },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("Invalid settings");
    });

    test("rejects an out-of-range windowMinutes", async ({ request }) => {
      const { token } = await loginAsAdminApi(request);
      const res = await request.put(apiUrl("/area-alerts/settings"), {
        headers: authHeader(token),
        data: { windowMinutes: 999 },
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe("trigger", () => {
    test("requires auth", async ({ request }) => {
      const res = await request.post(apiUrl("/area-alerts/trigger"), { data: { society: "Green Valley Society" } });
      expect(res.status()).toBe(401);
    });

    test("rejects a plain customer (agent or admin only) [BUG: returns 401, see file header]", async ({ request }) => {
      const { token } = await loginAsNewCustomerApi(request);
      const res = await request.post(apiUrl("/area-alerts/trigger"), {
        headers: authHeader(token),
        data: { society: "Green Valley Society" },
      });
      expect(res.status()).toBe(403);
    });

    test("rejects an empty society", async ({ request }) => {
      const { token } = await loginAsAgentApi(request);
      const res = await request.post(apiUrl("/area-alerts/trigger"), {
        headers: authHeader(token),
        data: { society: "" },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("society is required");
    });

    test("an agent can trigger an alert for a society", async ({ request }) => {
      const { token: adminToken } = await loginAsAdminApi(request);
      // Make sure alerts are enabled first (another test in this file may have left them disabled).
      await request.put(apiUrl("/area-alerts/settings"), { headers: authHeader(adminToken), data: { enabled: true } });

      const { token: agentToken } = await loginAsAgentApi(request);
      const society = `Test Society ${Date.now()}`;
      const res = await request.post(apiUrl("/area-alerts/trigger"), {
        headers: authHeader(agentToken),
        data: { society, agentName: "Test Agent" },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.data.society).toBe(society);
      expect(typeof body.data.sentCount).toBe("number");
      expect(body.message).toContain("nearby customer");
    });

    test("an admin can also trigger an alert", async ({ request }) => {
      const { token } = await loginAsAdminApi(request);
      await request.put(apiUrl("/area-alerts/settings"), { headers: authHeader(token), data: { enabled: true } });
      const res = await request.post(apiUrl("/area-alerts/trigger"), {
        headers: authHeader(token),
        data: { society: `Admin Triggered ${Date.now()}` },
      });
      expect(res.ok()).toBeTruthy();
    });
  });

  test.describe("triggered list", () => {
    test("requires auth", async ({ request }) => {
      const res = await request.get(apiUrl("/area-alerts/triggered"));
      expect(res.status()).toBe(401);
    });

    test("rejects a plain customer [BUG: returns 401, see file header]", async ({ request }) => {
      const { token } = await loginAsNewCustomerApi(request);
      const res = await request.get(apiUrl("/area-alerts/triggered"), { headers: authHeader(token) });
      expect(res.status()).toBe(403);
    });

    test("admin can list triggered alerts", async ({ request }) => {
      const { token } = await loginAsAdminApi(request);
      const res = await request.get(apiUrl("/area-alerts/triggered"), { headers: authHeader(token) });
      expect(res.ok()).toBeTruthy();
      expect(Array.isArray((await res.json()).data)).toBe(true);
    });

    test("agent can list triggered alerts too", async ({ request }) => {
      const { token } = await loginAsAgentApi(request);
      const res = await request.get(apiUrl("/area-alerts/triggered"), { headers: authHeader(token) });
      expect(res.ok()).toBeTruthy();
    });
  });
});

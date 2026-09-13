import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, freshPhone, DEMO_OTP } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi, loginAsPendingAgentApi, loginAsNewCustomerApi } from "../fixtures/admin-api-helpers";

test.describe("Admin — agents", () => {
  test("GET /admin/agents requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/agents"));
    expect(res.status()).toBe(401);
  });

  test("GET /admin/agents lists the seeded agents", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/agents"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.some((a: { phone: string }) => a.phone === "9000000001")).toBe(true);
  });

  test("GET /admin/agents/:id returns detail with earnings/job counts", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { userId: agentId } = await loginAsPendingAgentApi(request);
    const res = await request.get(apiUrl(`/admin/agents/${agentId}`), { headers: authHeader(adminToken) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.id).toBe(agentId);
    expect(typeof body.data.totalEarnings).toBe("number");
    expect(typeof body.data.completedJobs).toBe("number");
  });

  test("GET /admin/agents/:id 404s for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/agents/000000000000000000000000"), { headers: authHeader(token) });
    expect(res.status()).toBe(404);
  });

  test("GET /admin/agents/:id/activity returns booking history", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { userId: agentId } = await loginAsPendingAgentApi(request);
    const res = await request.get(apiUrl(`/admin/agents/${agentId}/activity`), { headers: authHeader(adminToken) });
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).data.bookings)).toBe(true);
  });

  test("PATCH /admin/agents/:id/status rejects an invalid enum value", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { userId: agentId } = await loginAsPendingAgentApi(request);
    const res = await request.patch(apiUrl(`/admin/agents/${agentId}/status`), {
      headers: authHeader(adminToken),
      data: { status: "not-a-real-status" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Invalid status");
  });

  test("PATCH /admin/agents/:id/status 404s for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.patch(apiUrl("/admin/agents/000000000000000000000000/status"), {
      headers: authHeader(token),
      data: { status: "verified" },
    });
    expect(res.status()).toBe(404);
  });

  test("verifies the pending seeded agent, then suspends it — status changes each time", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { userId: agentId } = await loginAsPendingAgentApi(request);

    const verify = await request.patch(apiUrl(`/admin/agents/${agentId}/status`), {
      headers: authHeader(adminToken),
      data: { status: "verified" },
    });
    expect(verify.ok()).toBeTruthy();
    expect((await verify.json()).data.status).toBe("verified");

    const suspend = await request.patch(apiUrl(`/admin/agents/${agentId}/status`), {
      headers: authHeader(adminToken),
      data: { status: "suspended" },
    });
    expect(suspend.ok()).toBeTruthy();
    expect((await suspend.json()).data.status).toBe("suspended");

    // Restore to pending so other tests/agents relying on SEED_PENDING_AGENT_PHONE's original state aren't disrupted.
    await request.patch(apiUrl(`/admin/agents/${agentId}/status`), {
      headers: authHeader(adminToken),
      data: { status: "pending" },
    });
  });

  test("PATCH /admin/agents/:id/area rejects an empty area", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { userId: agentId } = await loginAsPendingAgentApi(request);
    const res = await request.patch(apiUrl(`/admin/agents/${agentId}/area`), {
      headers: authHeader(adminToken),
      data: { area: "" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Area is required");
  });

  test("PATCH /admin/agents/:id/area updates the area", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { userId: agentId } = await loginAsPendingAgentApi(request);
    const newArea = `Test Area ${Date.now()}`;
    const res = await request.patch(apiUrl(`/admin/agents/${agentId}/area`), {
      headers: authHeader(adminToken),
      data: { area: newArea },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.area).toBe(newArea);

    // Restore the seed value.
    await request.patch(apiUrl(`/admin/agents/${agentId}/area`), {
      headers: authHeader(adminToken),
      data: { area: "Palm Greens" },
    });
  });
});

test.describe("Admin — customers", () => {
  test("GET /admin/customers requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/customers"));
    expect(res.status()).toBe(401);
  });

  test("GET /admin/customers lists a freshly created customer", async ({ request }) => {
    const { token: customerToken, userId } = await loginAsNewCustomerApi(request);
    void customerToken;
    const { token: adminToken } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/customers"), { headers: authHeader(adminToken) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.some((c: { id: string }) => c.id === userId)).toBe(true);
  });

  test("GET /admin/customers/:id returns detail with referral info", async ({ request }) => {
    const { userId } = await loginAsNewCustomerApi(request);
    const { token: adminToken } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl(`/admin/customers/${userId}`), { headers: authHeader(adminToken) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.id).toBe(userId);
    expect(body.data.referralCode).toBeTruthy();
    expect(Array.isArray(body.data.referredUsers)).toBe(true);
  });

  test("GET /admin/customers/:id 404s for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/customers/000000000000000000000000"), { headers: authHeader(token) });
    expect(res.status()).toBe(404);
  });

  test("GET /admin/customers/:id/activity returns bookings + payments", async ({ request }) => {
    const { userId } = await loginAsNewCustomerApi(request);
    const { token: adminToken } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl(`/admin/customers/${userId}/activity`), { headers: authHeader(adminToken) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data.bookings)).toBe(true);
    expect(Array.isArray(body.data.payments)).toBe(true);
  });

  test("PATCH /admin/customers/:id/status rejects an invalid enum value", async ({ request }) => {
    const { userId } = await loginAsNewCustomerApi(request);
    const { token: adminToken } = await loginAsAdminApi(request);
    const res = await request.patch(apiUrl(`/admin/customers/${userId}/status`), {
      headers: authHeader(adminToken),
      data: { status: "not-a-real-status" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Invalid status");
  });

  test("PATCH /admin/customers/:id/status 404s for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.patch(apiUrl("/admin/customers/000000000000000000000000/status"), {
      headers: authHeader(token),
      data: { status: "suspended" },
    });
    expect(res.status()).toBe(404);
  });

  test("suspending a customer is enforced end-to-end: their next OTP login is rejected with 403", async ({ request }) => {
    const phone = freshPhone();
    const { userId } = await loginAsNewCustomerApiForPhone(request, phone);
    const { token: adminToken } = await loginAsAdminApi(request);

    const suspend = await request.patch(apiUrl(`/admin/customers/${userId}/status`), {
      headers: authHeader(adminToken),
      data: { status: "suspended" },
    });
    expect(suspend.ok()).toBeTruthy();
    expect((await suspend.json()).data.status).toBe("suspended");

    await request.post(apiUrl("/auth/send-otp"), { data: { phone } });
    const reLogin = await request.post(apiUrl("/auth/verify-otp"), { data: { phone, code: DEMO_OTP } });
    expect(reLogin.status()).toBe(403);
    const body = await reLogin.json();
    expect(body.message).toMatch(/suspended|deactivated/i);
  });
});

/** Same as loginAsNewCustomerApi but for a caller-supplied phone, so the test above can re-login the same user later. */
async function loginAsNewCustomerApiForPhone(request: APIRequestContext, phone: string) {
  // verify-otp requires an existing account (NOT_REGISTERED otherwise) — see
  // fixtures/api-client.ts's loginByPhone doc for the full explanation.
  await request.post(apiUrl("/auth/customer/signup"), { data: { name: "Test Customer", phone } });
  await request.post(apiUrl("/auth/send-otp"), { data: { phone } });
  const res = await request.post(apiUrl("/auth/verify-otp"), { data: { phone, code: DEMO_OTP } });
  const body = await res.json();
  return { token: body.data.token as string, userId: body.data.user.id as string };
}

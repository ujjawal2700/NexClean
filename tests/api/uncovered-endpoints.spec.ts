import { test, expect, request as playwrightRequest } from "@playwright/test";
import { authHeader, DEMO_OTP, freshPhone } from "../fixtures/api-client";
import {
  apiUrl,
  loginAsAdminApi,
  loginAsAgentApi,
  loginAsNewCustomerApi,
  loginByPhoneApi,
} from "../fixtures/admin-api-helpers";

/**
 * A request context with no cookie jar.
 *
 * Sessions are httpOnly cookies now, and Playwright's shared `request` fixture
 * keeps them — so "send no Authorization header" is no longer the same as
 * "unauthenticated". Anything asserting a 401 has to come from a clean context.
 */
async function anonymous() {
  return playwrightRequest.newContext();
}

/**
 * The ten endpoints an audit found were never referenced anywhere in the suite.
 *
 * Several are destructive or security-relevant (account deactivation, password
 * change, bulk dispatch), which is exactly the kind of thing that should not
 * ship untested — a route nobody exercises is a route nobody notices breaking.
 */

test.describe("Auth — verify-otp-code (validate without creating a session)", () => {
  test("requires a real code and does not mint a token", async ({ request }) => {
    const phone = freshPhone();
    await request.post(apiUrl("/auth/send-otp"), { data: { phone } });

    const bad = await request.post(apiUrl("/auth/verify-otp-code"), { data: { phone, code: "000000" } });
    expect(bad.status()).toBe(400);

    const good = await request.post(apiUrl("/auth/verify-otp-code"), { data: { phone, code: DEMO_OTP } });
    expect(good.ok()).toBeTruthy();
    const body = await good.json();
    expect(body.data).toEqual({ verified: true });
    // This endpoint only validates — it must never hand back a session.
    expect(JSON.stringify(body)).not.toContain("token");
  });
});

test.describe("Auth — agent signup-basic", () => {
  test("creates an unverified cleaner and rejects a duplicate number", async ({ request }) => {
    const phone = freshPhone();
    await request.post(apiUrl("/auth/send-signup-otp"), { data: { phone } });

    const res = await request.post(apiUrl("/auth/agent/signup-basic"), {
      data: { name: "Basic Signup Cleaner", phone, city: "Indore", area: "Green Valley Society", code: DEMO_OTP },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Must start unverified — the KYC step is what promotes them to "pending".
    expect(body.data.user.agentStatus).toBe("unverified");
    expect(body.data.token).toBeTruthy();
    // The location the cleaner picked is what gets stored.
    expect(body.data.user.city).toBe("Indore");
    expect(body.data.user.area).toBe("Green Valley Society");

    const dup = await request.post(apiUrl("/auth/agent/signup-basic"), {
      data: { name: "Someone Else", phone, city: "Indore", area: "Tech Park", code: DEMO_OTP },
    });
    expect(dup.status()).toBe(400);
  });

  test("requires a city, but tolerates a city that has no areas listed yet", async ({ request }) => {
    const noCity = freshPhone();
    await request.post(apiUrl("/auth/send-signup-otp"), { data: { phone: noCity } });
    const missing = await request.post(apiUrl("/auth/agent/signup-basic"), {
      data: { name: "No City Cleaner", phone: noCity, area: "Somewhere", code: DEMO_OTP },
    });
    expect(missing.status()).toBe(400);

    // A freshly added city may have no zones yet — that must not block signup.
    const phone = freshPhone();
    await request.post(apiUrl("/auth/send-signup-otp"), { data: { phone } });
    const res = await request.post(apiUrl("/auth/agent/signup-basic"), {
      data: { name: "Arealess Cleaner", phone, city: "Bhopal", code: DEMO_OTP },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.user.city).toBe("Bhopal");
  });
});

test.describe("User — password change (OTP gated)", () => {
  test("rejects a wrong OTP, a short password, and unauthenticated callers", async ({ request }) => {
    const phone = freshPhone();
    const { token } = await loginByPhoneApi(request, phone);

    const anon = await anonymous();
    expect((await anon.patch(apiUrl("/users/me/password"), { data: { newPassword: "secret123", code: DEMO_OTP } })).status()).toBe(401);
    await anon.dispose();

    const short = await request.patch(apiUrl("/users/me/password"), {
      headers: authHeader(token),
      data: { newPassword: "abc", code: DEMO_OTP },
    });
    expect(short.status()).toBe(400);

    await request.post(apiUrl("/auth/send-otp"), { data: { phone } });
    const wrongCode = await request.patch(apiUrl("/users/me/password"), {
      headers: authHeader(token),
      data: { newPassword: "secret123", code: "000000" },
    });
    expect(wrongCode.status()).toBe(400);
  });

  test("sets a password when the OTP is valid", async ({ request }) => {
    const phone = freshPhone();
    const { token } = await loginByPhoneApi(request, phone);
    await request.post(apiUrl("/auth/send-otp"), { data: { phone } });

    const res = await request.patch(apiUrl("/users/me/password"), {
      headers: authHeader(token),
      data: { newPassword: "a-strong-password", code: DEMO_OTP },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.success).toBe(true);
  });
});

test.describe("User — account deactivation", () => {
  test("deactivating suspends the account and locks the user out", async ({ request }) => {
    const phone = freshPhone();
    const { token } = await loginByPhoneApi(request, phone);

    const anon = await anonymous();
    expect((await anon.post(apiUrl("/users/me/deactivate"))).status()).toBe(401);
    await anon.dispose();

    const res = await request.post(apiUrl("/users/me/deactivate"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.deactivated).toBe(true);

    // The existing token must stop working immediately...
    const after = await request.get(apiUrl("/bookings"), { headers: authHeader(token) });
    expect(after.status()).toBe(403);


    // ...and logging back in must be refused too.
    await request.post(apiUrl("/auth/send-otp"), { data: { phone } });
    const relogin = await request.post(apiUrl("/auth/verify-otp"), { data: { phone, code: DEMO_OTP } });
    expect(relogin.status()).toBe(403);
  });
});

test.describe("Notifications — device token lifecycle", () => {
  test("a token can be registered then unregistered", async ({ request }) => {
    const { token } = await loginAsNewCustomerApi(request);
    const device = `test-device-${Date.now()}`;

    expect((await request.post(apiUrl("/notifications/register-token"), {
      headers: authHeader(token), data: { token: device },
    })).ok()).toBeTruthy();

    const off = await request.post(apiUrl("/notifications/unregister-token"), {
      headers: authHeader(token), data: { token: device },
    });
    expect(off.ok()).toBeTruthy();
    expect((await off.json()).data.unregistered).toBe(true);

    // Unregistering again is harmless, and a junk body is rejected.
    expect((await request.post(apiUrl("/notifications/unregister-token"), {
      headers: authHeader(token), data: { token: device },
    })).ok()).toBeTruthy();
    expect((await request.post(apiUrl("/notifications/unregister-token"), {
      headers: authHeader(token), data: {},
    })).status()).toBe(400);
  });
});

test.describe("Agent — available jobs & area alert", () => {
  test("GET /agent/available-jobs returns an array for a verified cleaner", async ({ request }) => {
    const anon = await anonymous();
    expect((await anon.get(apiUrl("/agent/available-jobs"))).status()).toBe(401);
    await anon.dispose();

    const { token } = await loginAsAgentApi(request);
    const res = await request.get(apiUrl("/agent/available-jobs"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).data)).toBe(true);
  });

  test("POST /agent/notify-area validates the society and reports how many were reached", async ({ request }) => {
    const { token } = await loginAsAgentApi(request);

    expect((await request.post(apiUrl("/agent/notify-area"), {
      headers: authHeader(token), data: { society: "" },
    })).status()).toBe(400);

    const res = await request.post(apiUrl("/agent/notify-area"), {
      headers: authHeader(token), data: { society: "Green Valley Society" },
    });
    expect(res.ok()).toBeTruthy();
    expect(typeof (await res.json()).data.sentCount).toBe("number");
  });

  test("a customer cannot trigger an area alert", async ({ request }) => {
    const { token } = await loginAsNewCustomerApi(request);
    const res = await request.post(apiUrl("/agent/notify-area"), {
      headers: authHeader(token), data: { society: "Green Valley Society" },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("Admin — bulk auto-assign", () => {
  test("POST /admin/dispatch/auto-assign-all requires admin and reports a result", async ({ request }) => {
    const anon = await anonymous();
    expect((await anon.post(apiUrl("/admin/dispatch/auto-assign-all"))).status()).toBe(401);
    await anon.dispose();

    const { token: agentToken } = await loginAsAgentApi(request);
    expect((await request.post(apiUrl("/admin/dispatch/auto-assign-all"), {
      headers: authHeader(agentToken),
    })).status()).toBe(403);

    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/dispatch/auto-assign-all"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data).toBeDefined();
  });
});

test.describe("Admin — lead status", () => {
  test("status transitions are validated and persisted", async ({ request }) => {
    const created = await request.post(apiUrl("/leads"), {
      data: { name: "Status Lead", phone: freshPhone(), email: "lead@example.com", city: "StatusCity", location: "Somewhere" },
    });
    expect(created.ok()).toBeTruthy();
    const leadId = (await created.json()).data.id;

    const { token } = await loginAsAdminApi(request);

    const bad = await request.patch(apiUrl(`/admin/leads/${leadId}/status`), {
      headers: authHeader(token), data: { status: "not-a-status" },
    });
    expect(bad.status()).toBe(400);

    const ok = await request.patch(apiUrl(`/admin/leads/${leadId}/status`), {
      headers: authHeader(token), data: { status: "converted" },
    });
    expect(ok.ok()).toBeTruthy();
    expect((await ok.json()).data.status).toBe("converted");
  });
});

test.describe("Subscriptions — reschedule a wash", () => {
  test("rejects a missing slot, an invalid slot, and someone else's booking", async ({ request }) => {
    const { token } = await loginAsNewCustomerApi(request);

    // Missing fields are caught before any lookup.
    const missing = await request.patch(apiUrl("/subscriptions/schedule/000000000000000000000000"), {
      headers: authHeader(token), data: { date: new Date(Date.now() + 86400000).toISOString() },
    });
    expect(missing.status()).toBe(400);

    // Free-text slots must be refused — the slot string drives overdue logic.
    const badSlot = await request.patch(apiUrl("/subscriptions/schedule/000000000000000000000000"), {
      headers: authHeader(token),
      data: { date: new Date(Date.now() + 86400000).toISOString(), slot: "3:00 AM - whenever" },
    });
    expect(badSlot.status()).toBe(400);
    expect((await badSlot.json()).message).toContain("slot must be one of");

    // A valid shape against a booking that isn't theirs still fails, not 500s.
    const notFound = await request.patch(apiUrl("/subscriptions/schedule/000000000000000000000000"), {
      headers: authHeader(token),
      data: { date: new Date(Date.now() + 86400000).toISOString(), slot: "11:00 AM" },
    });
    expect(notFound.status()).toBeGreaterThanOrEqual(400);
    expect(notFound.status()).toBeLessThan(500);
  });
});

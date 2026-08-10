import { test, expect } from "@playwright/test";
import { authHeader, DEMO_OTP, freshPhone } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi, loginAsAgentApi, loginAsNewCustomerApi, loginByPhoneApi } from "../fixtures/admin-api-helpers";

/**
 * Session revocation, area-alert scoping, and referral-farming defences.
 * All three were "known limitations" until now, so these are the tests that
 * keep them from quietly regressing.
 */

test.describe("Session revocation (token versioning)", () => {
  test("signing out everywhere invalidates the token that did it", async ({ request }) => {
    const { token } = await loginAsNewCustomerApi(request);
    expect((await request.get(apiUrl("/bookings"), { headers: authHeader(token) })).status()).toBe(200);

    const out = await request.post(apiUrl("/users/me/logout-all"), { headers: authHeader(token) });
    expect(out.ok()).toBeTruthy();

    // A JWT is self-contained — before token versioning this kept working for 30 days.
    expect((await request.get(apiUrl("/bookings"), { headers: authHeader(token) })).status()).toBe(401);
  });

  test("a second device is signed out too, and a fresh login still works", async ({ request }) => {
    const phone = freshPhone();
    const a = await loginByPhoneApi(request, phone);
    const b = await loginByPhoneApi(request, phone); // same account, "another device"

    expect((await request.get(apiUrl("/bookings"), { headers: authHeader(b.token) })).status()).toBe(200);
    await request.post(apiUrl("/users/me/logout-all"), { headers: authHeader(a.token) });

    expect((await request.get(apiUrl("/bookings"), { headers: authHeader(b.token) })).status()).toBe(401);

    const fresh = await loginByPhoneApi(request, phone);
    expect((await request.get(apiUrl("/bookings"), { headers: authHeader(fresh.token) })).status()).toBe(200);
  });

  test("changing the password signs other devices out", async ({ request }) => {
    const phone = freshPhone();
    const old = await loginByPhoneApi(request, phone);
    await request.post(apiUrl("/auth/send-otp"), { data: { phone } });

    const changed = await request.patch(apiUrl("/users/me/password"), {
      headers: authHeader(old.token),
      data: { newPassword: "a-strong-password", code: DEMO_OTP },
    });
    expect(changed.ok()).toBeTruthy();

    // The whole point of changing a password after a compromise.
    expect((await request.get(apiUrl("/bookings"), { headers: authHeader(old.token) })).status()).toBe(401);
  });

  test("an admin suspending a customer kills their live session immediately", async ({ request }) => {
    const { token: victim, userId } = await loginAsNewCustomerApi(request);
    const { token: admin } = await loginAsAdminApi(request);

    expect((await request.get(apiUrl("/bookings"), { headers: authHeader(victim) })).status()).toBe(200);
    await request.patch(apiUrl(`/admin/customers/${userId}/status`), {
      headers: authHeader(admin), data: { status: "suspended" },
    });
    const after = await request.get(apiUrl("/bookings"), { headers: authHeader(victim) });
    expect([401, 403]).toContain(after.status());
  });
});

test.describe("Area alerts are scoped to where the cleaner actually works", () => {
  test("a cleaner may alert their own assigned area", async ({ request }) => {
    const { token } = await loginAsAgentApi(request); // seeded area: Green Valley Society
    const res = await request.post(apiUrl("/agent/notify-area"), {
      headers: authHeader(token), data: { society: "Green Valley Society" },
    });
    expect(res.ok()).toBeTruthy();
  });

  test("a cleaner may NOT alert a society they have nothing to do with", async ({ request }) => {
    const { token } = await loginAsAgentApi(request);
    const res = await request.post(apiUrl("/agent/notify-area"), {
      headers: authHeader(token), data: { society: "Somewhere They Do Not Work" },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toContain("only send an area alert");
  });

  test("the direct /area-alerts/trigger route enforces the same rule", async ({ request }) => {
    const { token } = await loginAsAgentApi(request);
    // Previously this route bypassed the check entirely.
    const blocked = await request.post(apiUrl("/area-alerts/trigger"), {
      headers: authHeader(token), data: { society: "Some Other Society Entirely" },
    });
    expect(blocked.status()).toBe(403);

    const allowed = await request.post(apiUrl("/area-alerts/trigger"), {
      headers: authHeader(token), data: { society: "Green Valley Society" },
    });
    expect(allowed.ok()).toBeTruthy();
  });

  test("an admin is not restricted", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/area-alerts/trigger"), {
      headers: authHeader(token), data: { society: "Any Society An Admin Likes" },
    });
    expect(res.ok()).toBeTruthy();
  });
});

test.describe("Referral farming", () => {
  test("you cannot refer yourself", async ({ request }) => {
    const phone = freshPhone();
    const { token } = await loginByPhoneApi(request, phone);
    const code = (await (await request.get(apiUrl("/users/me/referrals"), { headers: authHeader(token) })).json()).data.referralCode;

    const res = await request.post(apiUrl("/auth/customer/signup"), {
      data: { name: "Self Referrer", phone, referralCode: code },
    });
    expect(res.status()).toBe(400);
  });

  test("welcome coins stop after several referred signups from one device", async ({ request }) => {
    // A referrer whose code we'll reuse from a single "device".
    const { token: refToken } = await loginAsNewCustomerApi(request);
    const code = (await (await request.get(apiUrl("/users/me/referrals"), { headers: authHeader(refToken) })).json()).data.referralCode;

    const device = `farm-device-${Date.now()}`;
    const balances: number[] = [];

    for (let i = 0; i < 5; i++) {
      const phone = freshPhone();
      const signup = await request.post(apiUrl("/auth/customer/signup"), {
        headers: { "x-device-id": device },
        data: { name: `Farm Signup ${"x".repeat(i + 1)}`, phone, referralCode: code },
      });
      // The account is always created — blocking signups on a shared IP would
      // lock out real customers behind carrier NAT.
      expect(signup.ok()).toBeTruthy();

      const { token } = await loginByPhoneApi(request, phone);
      const wallet = await (await request.get(apiUrl("/wallet"), { headers: authHeader(token) })).json();
      balances.push(wallet.data.coins ?? 0);
    }

    const paid = balances.filter((c) => c > 0).length;
    // Early ones are rewarded, later ones are withheld.
    expect(paid).toBeGreaterThan(0);
    expect(paid).toBeLessThan(balances.length);
  });
});

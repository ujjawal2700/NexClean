import { test, expect } from "../fixtures/base";
import { DEMO_OTP, authHeader, freshPhone, loginAsNewCustomer, loginByPhone } from "../fixtures/api-client";

test.describe("User profile", () => {
  test("requires auth", async ({ request }) => {
    const res = await request.patch("/users/me", { data: { name: "Someone" } });
    expect(res.status()).toBe(401);
  });

  test("updates name and email", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.patch("/users/me", {
      headers: authHeader(token),
      data: { name: "Test Customer", email: "test-customer@example.com" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.name).toBe("Test Customer");
    expect(body.data.email).toBe("test-customer@example.com");
  });

  test("rejects an invalid email", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.patch("/users/me", { headers: authHeader(token), data: { email: "not-an-email" } });
    expect(res.status()).toBe(400);
  });

  test("adds and removes a vehicle", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const add = await request.post("/users/me/vehicles", {
      headers: authHeader(token),
      data: { type: "hatchback", name: "My Test Car" },
    });
    expect(add.ok()).toBeTruthy();
    const added = (await add.json()).data.vehicles.find((v: { name: string }) => v.name === "My Test Car");
    expect(added).toBeTruthy();

    const remove = await request.delete(`/users/me/vehicles/${added.id}`, { headers: authHeader(token) });
    expect(remove.ok()).toBeTruthy();
    const removed = (await remove.json()).data.vehicles.find((v: { id: string }) => v.id === added.id);
    expect(removed).toBeUndefined();
  });

  test("rejects a vehicle add with no type", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.post("/users/me/vehicles", { headers: authHeader(token), data: { name: "No Type" } });
    expect(res.status()).toBe(400);
  });

  test("adds and removes an address, with coordinates round-tripping", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const add = await request.post("/users/me/addresses", {
      headers: authHeader(token),
      data: { label: "Home", line: "42 Test Ave", lat: 22.7196, lng: 75.8577 },
    });
    expect(add.ok()).toBeTruthy();
    const added = (await add.json()).data.addresses.find((a: { line: string }) => a.line === "42 Test Ave");
    expect(added).toBeTruthy();
    expect(added.coordinates).toEqual([75.8577, 22.7196]); // GeoJSON is [lng, lat]

    const remove = await request.delete(`/users/me/addresses/${added.id}`, { headers: authHeader(token) });
    expect(remove.ok()).toBeTruthy();
  });

  test("rejects an address with an out-of-range latitude", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.post("/users/me/addresses", {
      headers: authHeader(token),
      data: { label: "Home", line: "42 Test Ave", lat: 999, lng: 75.8577 },
    });
    expect(res.status()).toBe(400);
  });

  test("referral summary responds with a code for a freshly created customer", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.get("/users/me/referrals", { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.referralCode).toBeTruthy();
    expect(typeof body.data.coins).toBe("number");
  });

  test.describe("Phone number change", () => {
    test("request-otp requires auth", async ({ request }) => {
      const res = await request.post("/users/me/phone/request-otp", { data: { phone: freshPhone() } });
      expect(res.status()).toBe(401);
    });

    test("request-otp rejects your own current phone number", async ({ request }) => {
      const phone = freshPhone();
      const { token } = await loginByPhone(request, phone);
      const res = await request.post("/users/me/phone/request-otp", { headers: authHeader(token), data: { phone } });
      expect(res.status()).toBe(400);
      expect((await res.json()).message).toContain("already your phone number");
    });

    test("request-otp rejects a phone already in use by another account", async ({ request }) => {
      const { token: otherToken } = await loginAsNewCustomer(request);
      // The "other" customer's own phone isn't exposed by /auth/me, so read it via a fresh signup collision instead:
      // easier — just reuse loginAsNewCustomer's phone by re-deriving through a second login attempt is indirect;
      // instead, request a change to a brand-new phone `p`, then have a THIRD customer try to claim `p` too.
      const targetPhone = freshPhone();
      const first = await request.post("/users/me/phone/request-otp", { headers: authHeader(otherToken), data: { phone: targetPhone } });
      expect(first.ok()).toBeTruthy();
      await request.post("/users/me/phone/confirm", { headers: authHeader(otherToken), data: { phone: targetPhone, code: DEMO_OTP } });

      const { token: thirdToken } = await loginAsNewCustomer(request);
      const collision = await request.post("/users/me/phone/request-otp", { headers: authHeader(thirdToken), data: { phone: targetPhone } });
      expect(collision.status()).toBe(400);
      expect((await collision.json()).message).toContain("already in use");
    });

    test("full happy path: request-otp then confirm actually changes the phone number", async ({ request }) => {
      const { token } = await loginAsNewCustomer(request);
      const newPhone = freshPhone();

      const request1 = await request.post("/users/me/phone/request-otp", { headers: authHeader(token), data: { phone: newPhone } });
      expect(request1.ok()).toBeTruthy();

      const confirm = await request.post("/users/me/phone/confirm", {
        headers: authHeader(token),
        data: { phone: newPhone, code: DEMO_OTP },
      });
      expect(confirm.ok()).toBeTruthy();
      expect((await confirm.json()).data.phone).toBe(newPhone);

      // Persisted, not just returned in the response — /auth/me reflects it too.
      const me = await (await request.get("/auth/me", { headers: authHeader(token) })).json();
      expect(me.data.phone).toBe(newPhone);
    });

    test("confirm rejects a wrong OTP", async ({ request }) => {
      const { token } = await loginAsNewCustomer(request);
      const newPhone = freshPhone();
      await request.post("/users/me/phone/request-otp", { headers: authHeader(token), data: { phone: newPhone } });
      const res = await request.post("/users/me/phone/confirm", {
        headers: authHeader(token),
        data: { phone: newPhone, code: "000000" },
      });
      expect(res.status()).toBe(400);
    });
  });
});

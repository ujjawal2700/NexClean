import { test, expect } from "../fixtures/base";
import { DEMO_OTP, freshPhone, loginAsAdmin, loginAsNewCustomer, authHeader } from "../fixtures/api-client";

test.describe("Auth", () => {
  test("send-otp rejects an invalid phone", async ({ request }) => {
    const res = await request.post("/auth/send-otp", { data: { phone: "123" } });
    expect(res.status()).toBe(400);
  });

  test("send-otp accepts a valid phone", async ({ request }) => {
    const res = await request.post("/auth/send-otp", { data: { phone: freshPhone() } });
    expect(res.ok()).toBeTruthy();
  });

  test("verify-otp rejects a wrong code", async ({ request }) => {
    const phone = freshPhone();
    await request.post("/auth/send-otp", { data: { phone } });
    const res = await request.post("/auth/verify-otp", { data: { phone, code: "000000" } });
    expect(res.status()).toBe(400);
  });

  test("verify-otp with the demo code logs in a registered customer", async ({ request }) => {
    // verify-otp no longer upserts an account on a fresh phone — it requires
    // one to already exist (NOT_REGISTERED otherwise), so sign up first. See
    // fixtures/api-client.ts's loginByPhone doc for the full explanation.
    const phone = freshPhone();
    await request.post("/auth/customer/signup", { data: { name: "Test Customer", phone } });
    await request.post("/auth/send-otp", { data: { phone } });
    const res = await request.post("/auth/verify-otp", { data: { phone, code: DEMO_OTP } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.token).toBeTruthy();
    expect(body.data.user.role).toBe("customer");
    expect(body.data.user.referralCode).toBeTruthy();
  });

  test("verify-otp rejects an unregistered phone", async ({ request }) => {
    const phone = freshPhone();
    await request.post("/auth/send-otp", { data: { phone } });
    const res = await request.post("/auth/verify-otp", { data: { phone, code: DEMO_OTP } });
    expect(res.status()).toBe(404);
    expect((await res.json()).message).toMatch(/not registered/i);
  });

  test("verify-otp is idempotent-safe: same phone twice returns the same user id", async ({ request }) => {
    const phone = freshPhone();
    await request.post("/auth/customer/signup", { data: { name: "Test Customer", phone } });
    await request.post("/auth/send-otp", { data: { phone } });
    const first = await (await request.post("/auth/verify-otp", { data: { phone, code: DEMO_OTP } })).json();
    await request.post("/auth/send-otp", { data: { phone } });
    const second = await (await request.post("/auth/verify-otp", { data: { phone, code: DEMO_OTP } })).json();
    expect(second.data.user.id).toBe(first.data.user.id);
  });

  test("admin-login rejects a wrong password", async ({ request }) => {
    const res = await request.post("/auth/admin-login", {
      data: { email: "superadmin@gmail.com", password: "definitely-wrong" },
    });
    expect(res.status()).toBe(401);
  });

  test("admin-login succeeds with the seeded credentials", async ({ request }) => {
    const { token } = await loginAsAdmin(request);
    expect(token).toBeTruthy();
  });

  test("GET /auth/me requires a bearer token", async ({ request }) => {
    const res = await request.get("/auth/me");
    expect(res.status()).toBe(401);
  });

  test("GET /auth/me returns the authenticated user", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.get("/auth/me", { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.role).toBe("customer");
  });

  test("GET /auth/me rejects a garbage token", async ({ request }) => {
    const res = await request.get("/auth/me", { headers: authHeader("not-a-real-token") });
    expect(res.status()).toBe(401);
  });
});

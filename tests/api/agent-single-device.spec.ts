import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import { DEMO_OTP, LEGAL_ACCEPTANCE, apiUrl, freshPhone } from "../fixtures/api-client";

/**
 * A cleaner may be signed in on one phone at a time. Logging in from another
 * install asks first; confirming signs the old phone out everywhere.
 */

const PHONE_A = { "X-Device-Id": "phone-a-install" };
const PHONE_B = { "X-Device-Id": "phone-b-install" };

async function newCleaner(request: APIRequestContext): Promise<string> {
  const phone = freshPhone();
  await request.post(apiUrl("/auth/send-signup-otp"), { data: { phone } });
  const res = await request.post(apiUrl("/auth/agent/signup-basic"), {
    data: { name: "One Phone Cleaner", phone, city: "Indore", code: DEMO_OTP, ...LEGAL_ACCEPTANCE },
  });
  expect(res.ok()).toBeTruthy();
  // Signed up with no device header, so no phone holds the account yet.
  return phone;
}

async function login(request: APIRequestContext, phone: string, device: Record<string, string>) {
  await request.post(apiUrl("/auth/send-login-otp"), { data: { phone, role: "agent" } });
  const res = await request.post(apiUrl("/auth/verify-otp"), { headers: device, data: { phone, code: DEMO_OTP } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data as { token?: string; deviceSwitchRequired?: true; switchTicket?: string };
}

const me = (request: APIRequestContext, token: string) =>
  request.get(apiUrl("/auth/me"), { headers: { Authorization: `Bearer ${token}` } });

test.describe("Agent — one phone at a time", () => {
  test("a second phone must confirm, and confirming signs the first phone out", async ({ request }) => {
    const phone = await newCleaner(request);
    const a = await login(request, phone, PHONE_A);
    expect(a.token).toBeTruthy();

    const b = await login(request, phone, PHONE_B);
    expect(b.deviceSwitchRequired).toBe(true);
    expect(b.token).toBeUndefined();
    // Not confirmed yet (the cleaner could still cancel): phone A is untouched.
    expect((await me(request, a.token!)).ok()).toBeTruthy();

    const confirm = await request.post(apiUrl("/auth/agent/confirm-device-switch"), {
      headers: PHONE_B,
      data: { switchTicket: b.switchTicket },
    });
    expect(confirm.ok()).toBeTruthy();
    const tokenB = (await confirm.json()).data.token as string;

    expect((await me(request, tokenB)).ok()).toBeTruthy();
    expect((await me(request, a.token!)).status()).toBe(401);

    // The ticket is single-use: replaying it can't mint another session.
    const replay = await request.post(apiUrl("/auth/agent/confirm-device-switch"), {
      headers: PHONE_B,
      data: { switchTicket: b.switchTicket },
    });
    expect(replay.status()).toBe(400);
  });

  test("the switch ticket only works on the phone that asked for it", async ({ request }) => {
    const phone = await newCleaner(request);
    await login(request, phone, PHONE_A);
    const b = await login(request, phone, PHONE_B);

    const stolen = await request.post(apiUrl("/auth/agent/confirm-device-switch"), {
      headers: { "X-Device-Id": "someone-else" },
      data: { switchTicket: b.switchTicket },
    });
    expect(stolen.status()).toBe(400);

    const garbage = await request.post(apiUrl("/auth/agent/confirm-device-switch"), {
      headers: PHONE_B,
      data: { switchTicket: "not-a-ticket" },
    });
    expect(garbage.status()).toBe(400);
  });

  test("logging in again on the same phone doesn't ask", async ({ request }) => {
    const phone = await newCleaner(request);
    const first = await login(request, phone, PHONE_A);
    const again = await login(request, phone, PHONE_A);
    expect(again.token).toBeTruthy();
    // And it didn't sign the earlier session out either.
    expect((await me(request, first.token!)).ok()).toBeTruthy();
  });

  test("switching phones revokes push registrations, and the new phone can register again", async ({ request }) => {
    const phone = await newCleaner(request);
    const a = await login(request, phone, PHONE_A);
    const reg = await request.post(apiUrl("/notifications/register-token"), {
      headers: { ...PHONE_A, Authorization: `Bearer ${a.token}` },
      data: { token: "fcm-phone-a-real-token-123" },
    });
    expect(reg.ok()).toBeTruthy();
    expect((await (await me(request, a.token!)).json()).data.pushReady).toBe(true);

    const b = await login(request, phone, PHONE_B);
    const confirm = await request.post(apiUrl("/auth/agent/confirm-device-switch"), {
      headers: PHONE_B,
      data: { switchTicket: b.switchTicket },
    });
    const tokenB = (await confirm.json()).data.token as string;
    // Phone A's token is gone with phone A's session.
    expect((await (await me(request, tokenB)).json()).data.pushReady).toBe(false);

    await request.post(apiUrl("/notifications/register-token"), {
      headers: { ...PHONE_B, Authorization: `Bearer ${tokenB}` },
      data: { token: "fcm-phone-b-real-token-456" },
    });
    expect((await (await me(request, tokenB)).json()).data.pushReady).toBe(true);

    // A placeholder token is not a way to receive pushes.
    const c = await newCleaner(request);
    const cs = await login(request, c, PHONE_A);
    await request.post(apiUrl("/notifications/register-token"), {
      headers: { ...PHONE_A, Authorization: `Bearer ${cs.token}` },
      data: { token: "web-placeholder-token-789" },
    });
    expect((await (await me(request, cs.token!)).json()).data.pushReady).toBe(false);
  });

  test("switching phones removes legacy push tokens without device mappings", async ({ request }) => {
    const phone = await newCleaner(request);
    const legacy = await login(request, phone, {});
    const reg = await request.post(apiUrl("/notifications/register-token"), {
      headers: { Authorization: `Bearer ${legacy.token}` },
      data: { token: "legacy-unmapped-fcm-token-123" },
    });
    expect(reg.ok()).toBeTruthy();
    expect((await (await me(request, legacy.token!)).json()).data.pushReady).toBe(true);

    await login(request, phone, PHONE_A);
    const b = await login(request, phone, PHONE_B);
    const confirm = await request.post(apiUrl("/auth/agent/confirm-device-switch"), {
      headers: PHONE_B, data: { switchTicket: b.switchTicket },
    });
    expect(confirm.ok()).toBeTruthy();
    const tokenB = (await confirm.json()).data.token;
    expect((await (await me(request, tokenB)).json()).data.pushReady).toBe(false);
    expect((await request.post(apiUrl("/notifications/register-token"), {
      headers: { ...PHONE_A, Authorization: `Bearer ${legacy.token}` },
      data: { token: "legacy-unmapped-fcm-token-123" },
    })).status()).toBe(401);
  });

  test("logout without a client push token revokes registrations and the old session", async ({ request }) => {
    const phone = await newCleaner(request);
    const a = await login(request, phone, PHONE_A);
    expect((await request.post(apiUrl("/notifications/register-token"), {
      headers: { ...PHONE_A, Authorization: `Bearer ${a.token}` },
      data: { token: "native-rotated-token-not-in-local-storage" },
    })).ok()).toBeTruthy();
    expect((await request.post(apiUrl("/auth/logout"), {
      headers: { ...PHONE_A, Authorization: `Bearer ${a.token}` }, data: { role: "agent" },
    })).ok()).toBeTruthy();
    expect((await me(request, a.token!)).status()).toBe(401);
    expect((await request.post(apiUrl("/notifications/register-token"), {
      headers: { ...PHONE_A, Authorization: `Bearer ${a.token}` },
      data: { token: "native-rotated-token-not-in-local-storage" },
    })).status()).toBe(401);
    const b = await login(request, phone, PHONE_B);
    expect(b.token).toBeTruthy();
    expect((await (await me(request, b.token!)).json()).data.pushReady).toBe(false);
  });

  test("an old phone cannot register with the new session or log the new phone out", async ({ request }) => {
    const phone = await newCleaner(request);
    const a = await login(request, phone, PHONE_A);
    const b = await login(request, phone, PHONE_B);
    const confirm = await request.post(apiUrl("/auth/agent/confirm-device-switch"), {
      headers: PHONE_B, data: { switchTicket: b.switchTicket },
    });
    const tokenB = (await confirm.json()).data.token;
    expect((await request.post(apiUrl("/notifications/register-token"), {
      headers: { ...PHONE_A, Authorization: `Bearer ${tokenB}` }, data: { token: "wrong-phone-native-token" },
    })).status()).toBe(401);
    expect((await request.post(apiUrl("/notifications/register-token"), {
      headers: { ...PHONE_B, Authorization: `Bearer ${tokenB}` }, data: { token: "new-phone-native-token" },
    })).ok()).toBeTruthy();
    await request.post(apiUrl("/auth/logout"), {
      headers: { ...PHONE_A, Authorization: `Bearer ${a.token}` }, data: { role: "agent" },
    });
    expect((await me(request, tokenB)).ok()).toBeTruthy();
    expect((await (await me(request, tokenB)).json()).data.pushReady).toBe(true);
  });

  test("after logging out, another phone logs in without the prompt", async ({ request }) => {
    const phone = await newCleaner(request);
    const a = await login(request, phone, PHONE_A);
    const out = await request.post(apiUrl("/auth/logout"), {
      headers: { ...PHONE_A, Authorization: `Bearer ${a.token}` },
      data: { role: "agent" },
    });
    expect(out.ok()).toBeTruthy();

    const b = await login(request, phone, PHONE_B);
    expect(b.token).toBeTruthy();
  });
});

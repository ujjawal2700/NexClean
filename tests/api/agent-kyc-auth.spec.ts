import { test, expect } from "../fixtures/base";
import { request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { DEMO_OTP, LEGAL_ACCEPTANCE, apiUrl, freshPhone } from "../fixtures/api-client";

/**
 * The KYC step (/auth/agent/signup) used to find the account by the phone in
 * the body, with no proof of owning it: anyone who knew an applicant's number
 * got a session for their account, and an unknown number got a new account
 * with no OTP. It now only completes the signed-in cleaner's own application.
 */

const IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const kyc = (phone: string, name = "KYC Cleaner") => ({
  name,
  phone,
  city: "Indore",
  aadharNumber: "123456789012",
  aadharFront: IMAGE,
  aadharBack: IMAGE,
  ...LEGAL_ACCEPTANCE,
});

async function applicant(request: APIRequestContext, name: string) {
  const phone = freshPhone();
  await request.post(apiUrl("/auth/send-signup-otp"), { data: { phone } });
  const res = await request.post(apiUrl("/auth/agent/signup-basic"), {
    data: { name, phone, city: "Indore", code: DEMO_OTP, ...LEGAL_ACCEPTANCE },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { phone, token: body.data.token as string, id: body.data.user.id as string };
}

test.describe("Agent KYC step requires the applicant's own session", () => {
  test("an existing applicant's number alone gets nothing", async ({ request }) => {
    const victim = await applicant(request, "Victim Applicant");
    // A separate, cookie-less client: `request` now holds the victim's session.
    const attacker = await playwrightRequest.newContext();
    const res = await attacker.post(apiUrl("/auth/agent/signup"), { data: kyc(victim.phone, "Attacker") });
    expect(res.status()).toBe(401);
    expect((await res.json()).data?.token).toBeUndefined();
    expect(res.headers()["set-cookie"] ?? "").not.toContain("nc_session_agent");
    await attacker.dispose();
  });

  test("an unknown number can't create an account without an OTP", async ({ request }) => {
    const phone = freshPhone();
    const stranger = await playwrightRequest.newContext();
    const res = await stranger.post(apiUrl("/auth/agent/signup"), { data: kyc(phone) });
    expect(res.status()).toBe(401);
    await stranger.dispose();

    // Nothing was created: logging in says the number isn't registered.
    const login = await request.post(apiUrl("/auth/send-login-otp"), { data: { phone, role: "agent" } });
    expect(JSON.stringify(await login.json())).toContain("NOT_REGISTERED");
  });

  test("a signed-in applicant can only complete their own application", async ({ request }) => {
    const me = await applicant(request, "Honest Applicant");
    const other = await applicant(request, "Other Applicant");

    // Naming someone else's phone in the body still applies to the session's account.
    const res = await request.post(apiUrl("/auth/agent/signup"), {
      headers: { Authorization: `Bearer ${me.token}` },
      data: kyc(other.phone, "Honest Applicant"),
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.user.id).toBe(me.id);
    expect(body.data.user.agentStatus).toBe("pending");

    const otherMe = await request.get(apiUrl("/auth/me"), { headers: { Authorization: `Bearer ${other.token}` } });
    expect((await otherMe.json()).data.agentStatus).toBe("unverified");
  });
});

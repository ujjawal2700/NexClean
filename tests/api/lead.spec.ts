import { test, expect } from "@playwright/test";
import { authHeader } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi } from "../fixtures/admin-api-helpers";

function validLead(extra: Record<string, unknown> = {}) {
  return {
    name: "Test Lead",
    phone: "9876543210",
    city: "Pune",
    location: "Baner Road",
    ...extra,
  };
}

test.describe("Leads", () => {
  test("public submission requires no auth and lands on the waitlist", async ({ request }) => {
    const res = await request.post(apiUrl("/leads"), { data: validLead({ phone: "9811111101" }) });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.message).toBe("You're on our waitlist! We'll notify you when we launch in your city.");
    expect(body.data.name).toBe("Test Lead");
    expect(body.data.city).toBe("Pune");
  });

  test("rejects a missing name", async ({ request }) => {
    const { name, ...rest } = validLead({ phone: "9811111102" });
    const res = await request.post(apiUrl("/leads"), { data: rest });
    expect(res.status()).toBe(400);
    const body = await res.json();
    // zod required-field error for a wholly-missing key.
    expect(body.message).toBe("Required");
  });

  test("rejects a too-short name", async ({ request }) => {
    const res = await request.post(apiUrl("/leads"), { data: validLead({ name: "A", phone: "9811111103" }) });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Enter your full name");
  });

  test("rejects an invalid phone format", async ({ request }) => {
    const res = await request.post(apiUrl("/leads"), { data: validLead({ phone: "123" }) });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Enter a valid phone number");
  });

  test("accepts an optional deviceToken and empty email", async ({ request }) => {
    const res = await request.post(apiUrl("/leads"), {
      data: validLead({ phone: "9811111104", deviceToken: "abc123", email: "" }),
    });
    expect(res.status()).toBe(201);
  });

  test("shows up via GET /admin/leads and can be deleted via DELETE /admin/leads/:id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const unique = `Lead-${Date.now()}`;
    const created = await (
      await request.post(apiUrl("/leads"), { data: validLead({ name: unique, phone: "9811111105" }) })
    ).json();
    const leadId = created.data.id;

    const list = await (await request.get(apiUrl("/admin/leads"), { headers: authHeader(token) })).json();
    expect(Array.isArray(list.data)).toBe(true);
    const found = list.data.find((l: { id: string }) => l.id === leadId);
    expect(found).toBeTruthy();
    expect(found.name).toBe(unique);

    const del = await request.delete(apiUrl(`/admin/leads/${leadId}`), { headers: authHeader(token) });
    expect(del.ok()).toBeTruthy();

    const listAfter = await (await request.get(apiUrl("/admin/leads"), { headers: authHeader(token) })).json();
    expect(listAfter.data.find((l: { id: string }) => l.id === leadId)).toBeUndefined();
  });

  test("GET /admin/leads requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/leads"));
    expect(res.status()).toBe(401);
  });
});

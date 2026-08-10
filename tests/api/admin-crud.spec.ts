import { test, expect } from "@playwright/test";
import { authHeader, freshPhone, DEMO_OTP } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi, loginAsNewCustomerApi, createMockPayment } from "../fixtures/admin-api-helpers";

/**
 * Admin-created agents and customers.
 *
 * The interesting cases aren't the happy paths — they're the guards: a phone
 * number is the login identity here, so a duplicate must be refused rather than
 * silently creating a second account nobody can sign into; and deleting a
 * person who has bookings or payments would orphan that history, so the API
 * pushes the admin toward suspension instead.
 */

test.describe("Admin CRUD — agents", () => {
  test("write routes require admin auth", async ({ request }) => {
    const create = await request.post(apiUrl("/admin/agents"), { data: { name: "Nobody", phone: freshPhone() } });
    expect(create.status()).toBe(401);
    const patch = await request.patch(apiUrl("/admin/agents/000000000000000000000000"), { data: { name: "Nobody" } });
    expect(patch.status()).toBe(401);
    const del = await request.delete(apiUrl("/admin/agents/000000000000000000000000"));
    expect(del.status()).toBe(401);
  });

  test("create → read → update → delete round trip", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const phone = freshPhone();

    const created = await request.post(apiUrl("/admin/agents"), {
      headers: authHeader(token),
      data: { name: "Created Agent", phone, email: "created.agent@example.com", area: "Vijay Nagar" },
    });
    expect(created.status()).toBe(201);
    const agent = (await created.json()).data as { id: string; name: string; phone: string; status: string };
    expect(agent.phone).toBe(phone);
    expect(agent.status).toBe("verified");

    const list = await request.get(apiUrl("/admin/agents"), { headers: authHeader(token) });
    expect((await list.json()).data.some((a: { id: string }) => a.id === agent.id)).toBe(true);

    const updated = await request.patch(apiUrl(`/admin/agents/${agent.id}`), {
      headers: authHeader(token),
      data: { name: "Renamed Agent", area: "Palasia" },
    });
    expect(updated.ok()).toBeTruthy();
    const after = (await updated.json()).data as { name: string; area: string };
    expect(after.name).toBe("Renamed Agent");
    expect(after.area).toBe("Palasia");

    const removed = await request.delete(apiUrl(`/admin/agents/${agent.id}`), { headers: authHeader(token) });
    expect(removed.ok()).toBeTruthy();

    const listAfter = await request.get(apiUrl("/admin/agents"), { headers: authHeader(token) });
    expect((await listAfter.json()).data.some((a: { id: string }) => a.id === agent.id)).toBe(false);
  });

  test("an admin-created agent can sign in with the phone it was given", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const phone = freshPhone();
    const created = await request.post(apiUrl("/admin/agents"), {
      headers: authHeader(token),
      data: { name: "Loginable Agent", phone },
    });
    expect(created.status()).toBe(201);

    await request.post(apiUrl("/auth/send-otp"), { data: { phone } });
    const login = await request.post(apiUrl("/auth/verify-otp"), { data: { phone, code: DEMO_OTP } });
    expect(login.ok()).toBeTruthy();
    expect((await login.json()).data.user.role).toBe("agent");
  });

  test("rejects a phone number already in use", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/agents"), {
      headers: authHeader(token),
      data: { name: "Clashing Agent", phone: "9000000001" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/already uses this mobile number/i);
  });

  test("rejects malformed names and phone numbers", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const badName = await request.post(apiUrl("/admin/agents"), {
      headers: authHeader(token),
      data: { name: "R2D2 <script>", phone: freshPhone() },
    });
    expect(badName.status()).toBe(400);

    const badPhone = await request.post(apiUrl("/admin/agents"), {
      headers: authHeader(token),
      data: { name: "Short Phone", phone: "12345" },
    });
    expect(badPhone.status()).toBe(400);
  });

  test("accepts a non-Latin name", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/agents"), {
      headers: authHeader(token),
      data: { name: "आरव शर्मा", phone: freshPhone() },
    });
    expect(res.status()).toBe(201);
    await request.delete(apiUrl(`/admin/agents/${(await res.json()).data.id}`), { headers: authHeader(token) });
  });

  test("update and delete 404 for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const patch = await request.patch(apiUrl("/admin/agents/000000000000000000000000"), {
      headers: authHeader(token),
      data: { name: "Ghost Agent" },
    });
    expect(patch.status()).toBe(404);
    const del = await request.delete(apiUrl("/admin/agents/000000000000000000000000"), { headers: authHeader(token) });
    expect(del.status()).toBe(404);
  });
});

test.describe("Admin CRUD — customers", () => {
  test("write routes require admin auth", async ({ request }) => {
    const create = await request.post(apiUrl("/admin/customers"), { data: { name: "Nobody", phone: freshPhone() } });
    expect(create.status()).toBe(401);
    const del = await request.delete(apiUrl("/admin/customers/000000000000000000000000"));
    expect(del.status()).toBe(401);
  });

  test("create → read → update → delete round trip", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const phone = freshPhone();

    const created = await request.post(apiUrl("/admin/customers"), {
      headers: authHeader(token),
      data: { name: "Created Customer", phone, email: "created.customer@example.com" },
    });
    expect(created.status()).toBe(201);
    const customer = (await created.json()).data as { id: string; phone: string; status: string };
    expect(customer.phone).toBe(phone);
    expect(customer.status).toBe("active");

    const list = await request.get(apiUrl("/admin/customers"), { headers: authHeader(token) });
    expect((await list.json()).data.some((c: { id: string }) => c.id === customer.id)).toBe(true);

    const updated = await request.patch(apiUrl(`/admin/customers/${customer.id}`), {
      headers: authHeader(token),
      data: { name: "Renamed Customer", email: "renamed@example.com" },
    });
    expect(updated.ok()).toBeTruthy();
    const after = (await updated.json()).data as { name: string; email: string };
    expect(after.name).toBe("Renamed Customer");
    expect(after.email).toBe("renamed@example.com");

    const removed = await request.delete(apiUrl(`/admin/customers/${customer.id}`), { headers: authHeader(token) });
    expect(removed.ok()).toBeTruthy();

    const detail = await request.get(apiUrl(`/admin/customers/${customer.id}`), { headers: authHeader(token) });
    expect(detail.status()).toBe(404);
  });

  test("rejects a phone number already in use", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const phone = freshPhone();
    const first = await request.post(apiUrl("/admin/customers"), {
      headers: authHeader(token),
      data: { name: "First Customer", phone },
    });
    expect(first.status()).toBe(201);

    const second = await request.post(apiUrl("/admin/customers"), {
      headers: authHeader(token),
      data: { name: "Second Customer", phone },
    });
    expect(second.status()).toBe(400);
    expect((await second.json()).message).toMatch(/already uses this mobile number/i);

    await request.delete(apiUrl(`/admin/customers/${(await first.json()).data.id}`), { headers: authHeader(token) });
  });

  test("refuses to delete a customer who has bookings, and points at suspension instead", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { token: customerToken, userId } = await loginAsNewCustomerApi(request);
    await createMockPayment(request, customerToken);

    const del = await request.delete(apiUrl(`/admin/customers/${userId}`), { headers: authHeader(adminToken) });
    expect(del.status()).toBe(400);
    const message = (await del.json()).message as string;
    expect(message).toMatch(/booking/i);
    expect(message).toMatch(/suspend/i);

    // The suggested alternative has to actually work, or the guard is a dead end.
    const suspend = await request.patch(apiUrl(`/admin/customers/${userId}/status`), {
      headers: authHeader(adminToken),
      data: { status: "suspended" },
    });
    expect(suspend.ok()).toBeTruthy();
    expect((await suspend.json()).data.status).toBe("suspended");
  });

  test("deletes a customer with no history", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { userId } = await loginAsNewCustomerApi(request);
    const del = await request.delete(apiUrl(`/admin/customers/${userId}`), { headers: authHeader(adminToken) });
    expect(del.ok()).toBeTruthy();
  });

  test("update and delete 404 for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const patch = await request.patch(apiUrl("/admin/customers/000000000000000000000000"), {
      headers: authHeader(token),
      data: { name: "Ghost Customer" },
    });
    expect(patch.status()).toBe(404);
    const del = await request.delete(apiUrl("/admin/customers/000000000000000000000000"), { headers: authHeader(token) });
    expect(del.status()).toBe(404);
  });
});

import { test, expect } from "@playwright/test";
import { authHeader } from "../fixtures/api-client";
import { apiUrl, createMockPayment, loginAsAdminApi, loginAsNewCustomerApi } from "../fixtures/admin-api-helpers";

test.describe("Admin — payments", () => {
  test("GET /admin/payments requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/payments"));
    expect(res.status()).toBe(401);
  });

  test("GET /admin/payments lists a freshly created payment", async ({ request }) => {
    const { token: customerToken } = await loginAsNewCustomerApi(request);
    const { orderId } = await createMockPayment(request, customerToken);

    const { token: adminToken } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/payments"), { headers: authHeader(adminToken) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.some((p: { orderId: string }) => p.orderId === orderId)).toBe(true);
  });

  test("GET /admin/payments/stats returns numeric totals", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/payments/stats"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    for (const key of ["totalCollected", "totalRefunded", "pendingSettlement", "settledAmount"]) {
      expect(typeof body.data[key]).toBe("number");
    }
  });

  test("PATCH /admin/payments/:id/refund 404s for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.patch(apiUrl("/admin/payments/000000000000000000000000/refund"), {
      headers: authHeader(token),
      data: {},
    });
    expect(res.status()).toBe(404);
  });

  test("PATCH /admin/payments/:id/settle 404s for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.patch(apiUrl("/admin/payments/000000000000000000000000/settle"), { headers: authHeader(token) });
    expect(res.status()).toBe(404);
  });

  // This environment runs payments in mock mode (no Razorpay keys — see
  // admin-api-helpers.ts), so a payment created through the public API never
  // reaches status "paid" (backend/src/modules/payment/payment.service.ts
  // verifyAndBook() only flips status to "paid" when paymentsLive is true).
  // These correctly document the gating rule refund/settle enforce, even
  // though a true happy-path isn't reachable without live payment keys.
  test("PATCH /admin/payments/:id/refund rejects a non-paid (mock) payment", async ({ request }) => {
    const { token: customerToken } = await loginAsNewCustomerApi(request);
    const { bookingId } = await createMockPayment(request, customerToken);
    void bookingId;
    const { token: adminToken } = await loginAsAdminApi(request);
    const payments = await (await request.get(apiUrl("/admin/payments"), { headers: authHeader(adminToken) })).json();
    const payment = payments.data.find((p: { bookingId: string }) => p.bookingId === bookingId);
    expect(payment.status).toBe("mock");

    const res = await request.patch(apiUrl(`/admin/payments/${payment.id}/refund`), {
      headers: authHeader(adminToken),
      data: {},
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Only paid payments can be refunded");
  });

  test("PATCH /admin/payments/:id/settle rejects a non-paid (mock) payment", async ({ request }) => {
    const { token: customerToken } = await loginAsNewCustomerApi(request);
    const { bookingId } = await createMockPayment(request, customerToken);
    const { token: adminToken } = await loginAsAdminApi(request);
    const payments = await (await request.get(apiUrl("/admin/payments"), { headers: authHeader(adminToken) })).json();
    const payment = payments.data.find((p: { bookingId: string }) => p.bookingId === bookingId);

    const res = await request.patch(apiUrl(`/admin/payments/${payment.id}/settle`), { headers: authHeader(adminToken) });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Only paid payments can be settled");
  });
});

test.describe("Admin — pricing", () => {
  test("GET /admin/pricing requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/pricing"));
    expect(res.status()).toBe(401);
  });

  test("GET /admin/pricing returns base + packages", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/pricing"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.data.base).toBe("object");
    expect(Array.isArray(body.data.packages)).toBe(true);
  });

  test("PUT /admin/pricing rejects a garbage body", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.put(apiUrl("/admin/pricing"), {
      headers: authHeader(token),
      data: { base: "not-an-object" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Invalid pricing");
  });

  test("PUT /admin/pricing updates and restores the hatchback base price", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const before = await (await request.get(apiUrl("/admin/pricing"), { headers: authHeader(token) })).json();
    const original = before.data.base.hatchback;

    const updated = await request.put(apiUrl("/admin/pricing"), {
      headers: authHeader(token),
      data: { base: { hatchback: original + 1 } },
    });
    expect(updated.ok()).toBeTruthy();
    expect((await updated.json()).data.base.hatchback).toBe(original + 1);

    const restored = await request.put(apiUrl("/admin/pricing"), {
      headers: authHeader(token),
      data: { base: { hatchback: original } },
    });
    expect((await restored.json()).data.base.hatchback).toBe(original);
  });
});

test.describe("Admin — plans", () => {
  test("GET /admin/plans requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/plans"));
    expect(res.status()).toBe(401);
  });

  test("GET /admin/plans lists the seeded plans", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/plans"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.some((p: { id: string }) => p.id === "basic")).toBe(true);
  });

  test("POST /admin/plans rejects a missing washesPerMonth", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/plans"), {
      headers: authHeader(token),
      data: { name: `Test Plan ${Date.now()}`, prices: { hatchback: 500 } },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Name, per-vehicle prices and washes per month are required");
  });

  test("full plan lifecycle: create → update → delete", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const name = `Test Plan ${Date.now()}`;

    const create = await request.post(apiUrl("/admin/plans"), {
      headers: authHeader(token),
      data: { name, prices: { hatchback: 500, sedan: 600 }, washesPerMonth: 4 },
    });
    expect(create.status()).toBe(201);
    const created = (await create.json()).data;
    expect(created.name).toBe(name);
    expect(created.washesPerMonth).toBe(4);

    const update = await request.patch(apiUrl(`/admin/plans/${created.id}`), {
      headers: authHeader(token),
      data: { washesPerMonth: 6 },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).data.washesPerMonth).toBe(6);

    const del = await request.delete(apiUrl(`/admin/plans/${created.id}`), { headers: authHeader(token) });
    expect(del.ok()).toBeTruthy();

    const list = await (await request.get(apiUrl("/admin/plans"), { headers: authHeader(token) })).json();
    expect(list.data.find((p: { id: string }) => p.id === created.id)).toBeUndefined();
  });

  test("PATCH /admin/plans/:id 404s for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.patch(apiUrl("/admin/plans/does-not-exist"), {
      headers: authHeader(token),
      data: { washesPerMonth: 2 },
    });
    expect(res.status()).toBe(404);
  });

  test("DELETE /admin/plans/:id 404s for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.delete(apiUrl("/admin/plans/does-not-exist"), { headers: authHeader(token) });
    expect(res.status()).toBe(404);
  });
});

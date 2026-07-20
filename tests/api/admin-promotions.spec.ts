import { test, expect } from "@playwright/test";
import { authHeader } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi, loginAsNewCustomerApi } from "../fixtures/admin-api-helpers";

test.describe("Admin — discount codes", () => {
  test("GET /admin/discount-codes requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/discount-codes"));
    expect(res.status()).toBe(401);
  });

  test("POST /admin/discount-codes rejects a garbage body", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/discount-codes"), {
      headers: authHeader(token),
      data: { code: "", type: "not-a-real-type" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Invalid discount code");
  });

  test("full discount code lifecycle: create → update → delete", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const code = `TEST${Date.now()}`;

    const create = await request.post(apiUrl("/admin/discount-codes"), {
      headers: authHeader(token),
      data: { code, type: "percent", value: 10 },
    });
    expect(create.status()).toBe(201);
    const discount = (await create.json()).data;
    expect(discount.code).toBe(code.toUpperCase());
    expect(discount.active).toBe(true);

    const update = await request.patch(apiUrl(`/admin/discount-codes/${discount.id}`), {
      headers: authHeader(token),
      data: { active: false },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).data.active).toBe(false);

    const del = await request.delete(apiUrl(`/admin/discount-codes/${discount.id}`), { headers: authHeader(token) });
    expect(del.ok()).toBeTruthy();
  });
});

test.describe("Admin — special coupons", () => {
  test("GET /admin/special-coupons requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/special-coupons"));
    expect(res.status()).toBe(401);
  });

  test("POST /admin/special-coupons/generate creates SPX-prefixed codes", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/special-coupons/generate"), {
      headers: authHeader(token),
      data: { count: 3, type: "flat", value: 50 },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.length).toBe(3);
    for (const coupon of body.data) {
      expect(coupon.code.startsWith("SPX-")).toBe(true);
      expect(coupon.status).toBe("active");
    }
  });

  test("assign → toggle-active → reactivate a generated coupon", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { userId: customerId } = await loginAsNewCustomerApi(request);

    const generated = await (
      await request.post(apiUrl("/admin/special-coupons/generate"), {
        headers: authHeader(adminToken),
        data: { count: 1, type: "percent", value: 20 },
      })
    ).json();
    const couponId = generated.data[0].id;

    const assign = await request.patch(apiUrl(`/admin/special-coupons/${couponId}/assign`), {
      headers: authHeader(adminToken),
      data: { customerId },
    });
    expect(assign.ok()).toBeTruthy();
    const assigned = (await assign.json()).data.assignedCustomer;
    expect(assigned?.id ?? assigned).toBeTruthy();

    const deactivate = await request.patch(apiUrl(`/admin/special-coupons/${couponId}/toggle-active`), {
      headers: authHeader(adminToken),
      data: { active: false },
    });
    expect(deactivate.ok()).toBeTruthy();
    expect((await deactivate.json()).data.status).toBe("inactive");

    const reactivate = await request.patch(apiUrl(`/admin/special-coupons/${couponId}/reactivate`), {
      headers: authHeader(adminToken),
    });
    // reactivate only works on a "used" coupon — this one is "inactive", so it should be rejected.
    expect(reactivate.status()).toBe(400);
    expect((await reactivate.json()).message).toBe("Only a used coupon can be reactivated");
  });

  test("PATCH .../assign 404s for an unknown coupon", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { userId: customerId } = await loginAsNewCustomerApi(request);
    const res = await request.patch(apiUrl("/admin/special-coupons/000000000000000000000000/assign"), {
      headers: authHeader(adminToken),
      data: { customerId },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("Admin — promo banners", () => {
  test("GET /admin/promo-banners requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/promo-banners"));
    expect(res.status()).toBe(401);
  });

  test("POST /admin/promo-banners rejects a garbage body", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/promo-banners"), { headers: authHeader(token), data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Invalid promotional banner");
  });

  test("full promo banner lifecycle: create → update → delete", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const title = `Test Banner ${Date.now()}`;

    const create = await request.post(apiUrl("/admin/promo-banners"), {
      headers: authHeader(token),
      data: { title, imageUrl: "https://example.com/banner.png" },
    });
    expect(create.status()).toBe(201);
    const banner = (await create.json()).data;
    expect(banner.title).toBe(title);

    const update = await request.patch(apiUrl(`/admin/promo-banners/${banner.id}`), {
      headers: authHeader(token),
      data: { active: false },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).data.active).toBe(false);

    const del = await request.delete(apiUrl(`/admin/promo-banners/${banner.id}`), { headers: authHeader(token) });
    expect(del.ok()).toBeTruthy();
  });
});

test.describe("Admin — campaigns", () => {
  test("GET /admin/campaigns requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/campaigns"));
    expect(res.status()).toBe(401);
  });

  test("GET /admin/campaigns/audience-sizes returns counts per audience", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/campaigns/audience-sizes"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.data["All customers"]).toBe("number");
  });

  test("POST /admin/campaigns rejects a missing field", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/campaigns"), {
      headers: authHeader(token),
      data: { title: "Hello" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Title, body and audience are required");
  });

  test("POST /admin/campaigns sends to an audience and records sentCount", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/campaigns"), {
      headers: authHeader(token),
      data: { title: `Campaign ${Date.now()}`, body: "Hello there!", audience: "All customers" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(typeof body.data.sentCount).toBe("number");

    const list = await (await request.get(apiUrl("/admin/campaigns"), { headers: authHeader(token) })).json();
    expect(list.data.find((c: { id: string }) => c.id === body.data.id)).toBeTruthy();
  });
});

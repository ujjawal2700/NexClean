import { test, expect } from "@playwright/test";
import { authHeader } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi } from "../fixtures/admin-api-helpers";

test.describe("Admin — cities", () => {
  test("GET /admin/cities requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/cities"));
    expect(res.status()).toBe(401);
  });

  test("POST /admin/cities rejects an empty name", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/cities"), { headers: authHeader(token), data: { name: "" } });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("City name is required");
  });

  test("full city lifecycle: create → update → delete", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const name = `Test City ${Date.now()}`;

    const create = await request.post(apiUrl("/admin/cities"), { headers: authHeader(token), data: { name } });
    expect(create.status()).toBe(201);
    const city = (await create.json()).data;
    expect(city.name).toBe(name);
    expect(city.active).toBe(true);

    const list = await (await request.get(apiUrl("/admin/cities"), { headers: authHeader(token) })).json();
    expect(list.data.find((c: { id: string }) => c.id === city.id)).toBeTruthy();

    const update = await request.patch(apiUrl(`/admin/cities/${city.id}`), {
      headers: authHeader(token),
      data: { active: false },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).data.active).toBe(false);

    const del = await request.delete(apiUrl(`/admin/cities/${city.id}`), { headers: authHeader(token) });
    expect(del.ok()).toBeTruthy();

    const listAfter = await (await request.get(apiUrl("/admin/cities"), { headers: authHeader(token) })).json();
    expect(listAfter.data.find((c: { id: string }) => c.id === city.id)).toBeUndefined();
  });

  test("PATCH /admin/cities/:id 404s for an unknown id", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.patch(apiUrl("/admin/cities/000000000000000000000000"), {
      headers: authHeader(token),
      data: { active: false },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("Admin — zones", () => {
  test("GET /admin/zones requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/zones"));
    expect(res.status()).toBe(401);
  });

  test("POST /admin/zones rejects a missing name/cityId", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/zones"), { headers: authHeader(token), data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Zone name and city are required");
  });

  test("full zone lifecycle: create → update → delete (against a real city)", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const cityName = `Test City ${Date.now()}`;
    const city = (await (await request.post(apiUrl("/admin/cities"), { headers: authHeader(token), data: { name: cityName } })).json()).data;

    const zoneName = `Test Zone ${Date.now()}`;
    const create = await request.post(apiUrl("/admin/zones"), {
      headers: authHeader(token),
      data: { name: zoneName, cityId: city.id },
    });
    expect(create.status()).toBe(201);
    const zone = (await create.json()).data;
    expect(zone.name).toBe(zoneName);
    expect(zone.cityId).toBe(city.id);

    const update = await request.patch(apiUrl(`/admin/zones/${zone.id}`), {
      headers: authHeader(token),
      data: { active: false },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).data.active).toBe(false);

    const del = await request.delete(apiUrl(`/admin/zones/${zone.id}`), { headers: authHeader(token) });
    expect(del.ok()).toBeTruthy();

    // Clean up the city too, now that its zone is gone.
    await request.delete(apiUrl(`/admin/cities/${city.id}`), { headers: authHeader(token) });
  });

  test("POST /admin/zones rejects an unknown cityId", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/zones"), {
      headers: authHeader(token),
      data: { name: "Some Zone", cityId: "000000000000000000000000" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Unknown city");
  });

  test("a city with zones cannot be deleted", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const city = (await (await request.post(apiUrl("/admin/cities"), { headers: authHeader(token), data: { name: `City ${Date.now()}` } })).json()).data;
    const zone = (
      await (
        await request.post(apiUrl("/admin/zones"), { headers: authHeader(token), data: { name: `Zone ${Date.now()}`, cityId: city.id } })
      ).json()
    ).data;

    const del = await request.delete(apiUrl(`/admin/cities/${city.id}`), { headers: authHeader(token) });
    expect(del.status()).toBe(400);
    expect((await del.json()).message).toBe("Remove the zones in this city first");

    // Clean up.
    await request.delete(apiUrl(`/admin/zones/${zone.id}`), { headers: authHeader(token) });
    await request.delete(apiUrl(`/admin/cities/${city.id}`), { headers: authHeader(token) });
  });
});

test.describe("Admin — vehicle categories", () => {
  test("GET /admin/vehicle-categories requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/vehicle-categories"));
    expect(res.status()).toBe(401);
  });

  test("GET /admin/vehicle-categories returns the self-seeded categories", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/vehicle-categories"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.some((c: { key: string }) => c.key === "hatchback")).toBe(true);
  });

  test("POST /admin/vehicle-categories rejects a missing basePrice", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/vehicle-categories"), {
      headers: authHeader(token),
      data: { name: "Test Category" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Category name and base price are required");
  });

  test("full vehicle category lifecycle: create → update → delete", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const name = `Test Category ${Date.now()}`;

    const create = await request.post(apiUrl("/admin/vehicle-categories"), {
      headers: authHeader(token),
      data: { name, basePrice: 555 },
    });
    expect(create.status()).toBe(201);
    const category = (await create.json()).data;
    expect(category.name).toBe(name);
    expect(category.basePrice).toBe(555);

    const update = await request.patch(apiUrl(`/admin/vehicle-categories/${category.id}`), {
      headers: authHeader(token),
      data: { basePrice: 600 },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).data.basePrice).toBe(600);

    const del = await request.delete(apiUrl(`/admin/vehicle-categories/${category.id}`), { headers: authHeader(token) });
    expect(del.ok()).toBeTruthy();
  });
});

test.describe("Admin — vehicle brands & models", () => {
  test("GET /admin/vehicle-brands requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/vehicle-brands"));
    expect(res.status()).toBe(401);
  });

  test("POST /admin/vehicle-brands rejects an empty name", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/vehicle-brands"), { headers: authHeader(token), data: { name: "" } });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Brand name is required");
  });

  test("POST /admin/vehicle-brands/:id/models rejects a missing categoryKey", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const brand = (
      await (await request.post(apiUrl("/admin/vehicle-brands"), { headers: authHeader(token), data: { name: `Brand ${Date.now()}` } })).json()
    ).data;

    const res = await request.post(apiUrl(`/admin/vehicle-brands/${brand.id}/models`), {
      headers: authHeader(token),
      data: { name: "Some Model" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Model name and category are required");

    await request.delete(apiUrl(`/admin/vehicle-brands/${brand.id}`), { headers: authHeader(token) });
  });

  test("full brand + nested model lifecycle: create brand → create model → update → delete model → delete brand", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const brandName = `Test Brand ${Date.now()}`;

    const createBrand = await request.post(apiUrl("/admin/vehicle-brands"), { headers: authHeader(token), data: { name: brandName } });
    expect(createBrand.status()).toBe(201);
    const brand = (await createBrand.json()).data;

    const modelName = `Test Model ${Date.now()}`;
    const createModel = await request.post(apiUrl(`/admin/vehicle-brands/${brand.id}/models`), {
      headers: authHeader(token),
      data: { name: modelName, categoryKey: "hatchback" },
    });
    expect(createModel.status()).toBe(201);
    const model = (await createModel.json()).data;
    expect(model.name).toBe(modelName);
    expect(model.brand).toBe(brand.id);

    const list = await (await request.get(apiUrl(`/admin/vehicle-brands/${brand.id}/models`), { headers: authHeader(token) })).json();
    expect(list.data.find((m: { id: string }) => m.id === model.id)).toBeTruthy();

    const update = await request.patch(apiUrl(`/admin/vehicle-brands/${brand.id}/models/${model.id}`), {
      headers: authHeader(token),
      data: { active: false },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).data.active).toBe(false);

    const delModel = await request.delete(apiUrl(`/admin/vehicle-brands/${brand.id}/models/${model.id}`), { headers: authHeader(token) });
    expect(delModel.ok()).toBeTruthy();

    const delBrand = await request.delete(apiUrl(`/admin/vehicle-brands/${brand.id}`), { headers: authHeader(token) });
    expect(delBrand.ok()).toBeTruthy();
  });

  test("POST .../models 404s for an unknown brand", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/vehicle-brands/000000000000000000000000/models"), {
      headers: authHeader(token),
      data: { name: "Model", categoryKey: "hatchback" },
    });
    expect(res.status()).toBe(404);
  });
});

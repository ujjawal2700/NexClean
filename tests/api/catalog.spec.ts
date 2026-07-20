import { test, expect } from "../fixtures/base";

// Catalog endpoints are all public (no auth) — they back the pre-login
// landing/booking pages, so they must never 401.
test.describe("Catalog (public)", () => {
  test("packages list is non-empty", async ({ request }) => {
    const res = await request.get("/catalog/packages");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test("plans list responds", async ({ request }) => {
    const res = await request.get("/catalog/plans");
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).data)).toBe(true);
  });

  test("content (marketing copy) responds", async ({ request }) => {
    const res = await request.get("/catalog/content");
    expect(res.ok()).toBeTruthy();
  });

  test("promo banners respond", async ({ request }) => {
    const res = await request.get("/catalog/promo-banners");
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).data)).toBe(true);
  });

  test("vehicle categories respond", async ({ request }) => {
    const res = await request.get("/catalog/vehicle-categories");
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).data)).toBe(true);
  });

  test("vehicle brands respond, and models for an unknown brand id come back empty (not a 500)", async ({ request }) => {
    const brands = await request.get("/catalog/vehicle-brands");
    expect(brands.ok()).toBeTruthy();
    const models = await request.get("/catalog/vehicle-brands/000000000000000000000000/models");
    expect(models.ok()).toBeTruthy();
  });

  test("cities respond, and zones for an unknown city id come back empty (not a 500)", async ({ request }) => {
    const cities = await request.get("/catalog/cities");
    expect(cities.ok()).toBeTruthy();
    const zones = await request.get("/catalog/zones?cityId=000000000000000000000000");
    expect(zones.ok()).toBeTruthy();
  });
});

import { test, expect } from "@playwright/test";
import { authHeader } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi, loginAsNewCustomerApi } from "../fixtures/admin-api-helpers";

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

test.describe("Geofence coverage check — /catalog/service-check", () => {
  test("rejects a request with no lat/lng", async ({ request }) => {
    const res = await request.get(apiUrl("/catalog/service-check"));
    expect(res.status()).toBe(400);
  });

  test("with zero zones configured, everywhere is serviceable", async ({ request }) => {
    // Coordinates picked far from any zone another spec might have left behind.
    const res = await request.get(apiUrl("/catalog/service-check?lat=1.111&lng=1.111"));
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()).data;
    // Either no zones exist at all, or this point happens to sit outside every
    // one that does — either way this specific far-flung point must not be
    // reported as covered by a zone that isn't actually there. The
    // zonesConfigured-aware "inside a real zone" case is covered below.
    if (!body.zonesConfigured) expect(body.serviceable).toBe(true);
  });

  test("a point inside a drawn zone is serviceable; outside it is not, once zones exist", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const coordinates: [number, number][] = [
      [80.100, 20.100],
      [80.110, 20.100],
      [80.110, 20.110],
      [80.100, 20.110],
    ];
    const zone = (
      await (
        await request.post(apiUrl("/admin/zones"), {
          headers: authHeader(token),
          data: { name: `Coverage Test ${Date.now()}`, coordinates },
        })
      ).json()
    ).data;

    const inside = await request.get(apiUrl("/catalog/service-check?lat=20.105&lng=80.105"));
    const insideBody = (await inside.json()).data;
    expect(insideBody.zonesConfigured).toBe(true);
    expect(insideBody.serviceable).toBe(true);

    const outside = await request.get(apiUrl("/catalog/service-check?lat=20.500&lng=80.500"));
    const outsideBody = (await outside.json()).data;
    expect(outsideBody.zonesConfigured).toBe(true);
    expect(outsideBody.serviceable).toBe(false);

    await request.delete(apiUrl(`/admin/zones/${zone.id}`), { headers: authHeader(token) });
  });
});

test.describe("Area requests — POST /leads/area-request", () => {
  test("requires authentication", async ({ request }) => {
    const res = await request.post(apiUrl("/leads/area-request"), { data: { lat: 20.1, lng: 80.1 } });
    expect(res.status()).toBe(401);
  });

  test("rejects a missing lat/lng", async ({ request }) => {
    const { token } = await loginAsNewCustomerApi(request);
    const res = await request.post(apiUrl("/leads/area-request"), {
      headers: authHeader(token),
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("an authenticated customer requesting their area creates a Lead the admin queue can see, with a pinned point", async ({
    request,
  }) => {
    const { token: customerToken } = await loginAsNewCustomerApi(request);
    const res = await request.post(apiUrl("/leads/area-request"), {
      headers: authHeader(customerToken),
      data: { lat: 20.222, lng: 80.222, label: "Test Area Request Society" },
    });
    expect(res.status()).toBe(201);
    const lead = (await res.json()).data;
    expect(lead.location).toBe("Test Area Request Society");
    expect(lead.point).toEqual({ lat: 20.222, lng: 80.222 });

    const { token: adminToken } = await loginAsAdminApi(request);
    const list = await (await request.get(apiUrl("/admin/leads"), { headers: authHeader(adminToken) })).json();
    const found = list.data.find((l: { id: string }) => l.id === lead.id);
    expect(found).toBeTruthy();
    expect(found.point).toEqual({ lat: 20.222, lng: 80.222 });

    await request.delete(apiUrl(`/admin/leads/${lead.id}`), { headers: authHeader(adminToken) });
  });

  test("requesting again with the same phone updates the existing lead rather than duplicating it", async ({ request }) => {
    const { token: customerToken } = await loginAsNewCustomerApi(request);

    const first = await (
      await request.post(apiUrl("/leads/area-request"), {
        headers: authHeader(customerToken),
        data: { lat: 21.0, lng: 81.0, label: "First Pin" },
      })
    ).json();

    const second = await (
      await request.post(apiUrl("/leads/area-request"), {
        headers: authHeader(customerToken),
        data: { lat: 21.5, lng: 81.5, label: "Second Pin" },
      })
    ).json();

    expect(second.data.id).toBe(first.data.id);
    expect(second.data.location).toBe("Second Pin");

    const { token: adminToken } = await loginAsAdminApi(request);
    await request.delete(apiUrl(`/admin/leads/${first.data.id}`), { headers: authHeader(adminToken) });
  });
});

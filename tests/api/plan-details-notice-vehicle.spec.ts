import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import { apiUrl, authHeader, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";

/**
 * Covers four admin/customer features together:
 *  - plan tagline / description / key points (Admin → Subscriptions → customer plan detail)
 *  - the admin-set booking notice (Admin → Time Slots), and the server enforcing it
 *  - colour on saved vehicles
 *  - vehicle number + colour on on-demand bookings, surfaced to admin
 */

type SlotConfig = { slots: string[]; leadMinutes: number; defaultLeadMinutes: number; maxLeadMinutes: number };

async function getSlotConfig(request: APIRequestContext, token: string): Promise<SlotConfig> {
  const res = await request.get(apiUrl("/admin/time-slots"), { headers: authHeader(token) });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data;
}

async function putSlotConfig(request: APIRequestContext, token: string, data: { slots: string[]; leadMinutes?: number }) {
  return request.put(apiUrl("/admin/time-slots"), { headers: authHeader(token), data });
}

async function firstPackageId(request: APIRequestContext): Promise<string> {
  const res = await request.get(apiUrl("/catalog/packages"));
  return (await res.json()).data[0].id;
}

async function businessTimezone(request: APIRequestContext): Promise<string> {
  const res = await request.get(apiUrl("/catalog/off-peak-hours"));
  return (await res.json()).data?.timezone ?? "Asia/Kolkata";
}

/** Minutes since midnight right now in `tz`. */
function nowMinutesIn(tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

/** 810 → "01:30 PM". */
function toSlotLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

function bookingPayload(packageId: string, extra: Record<string, unknown> = {}) {
  return {
    vehicleType: "hatchback",
    vehicleName: "Test Car",
    packageId,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    slot: "11:00 AM",
    addressLabel: "Home",
    addressLine: "123 Test Street",
    ...extra,
  };
}

test.describe("Plan details (tagline, description, key points)", () => {
  test("admin creates and edits plan copy; the customer catalog serves it", async ({ request }) => {
    const { token } = await loginAsAdmin(request);
    const name = `Detail Plan ${Date.now()}`;
    const options = (await (await request.get(apiUrl("/admin/plans/options"), { headers: authHeader(token) })).json()).data;
    const pkg = options.pricing.packages.find((p: { active?: boolean }) => p.active !== false);
    const create = await request.post(apiUrl("/admin/plans"), {
      headers: authHeader(token),
      data: {
        name,
        packageId: pkg.id,
        discountPercentage: 20,
        washesPerMonth: 4,
        tagline: "  Great for city cars  ",
        description: "Four washes a month.\nInterior included.",
        keyPoints: ["Doorstep service", "  ", "Free rescheduling"],
      },
    });
    expect(create.status()).toBe(201);
    const plan = (await create.json()).data;
    try {
      expect(plan.tagline).toBe("Great for city cars");
      expect(plan.description).toBe("Four washes a month.\nInterior included.");
      // Blank key points are dropped.
      expect(plan.keyPoints).toEqual(["Doorstep service", "Free rescheduling"]);

      const patch = await request.patch(apiUrl(`/admin/plans/${plan.id}`), {
        headers: authHeader(token),
        data: { keyPoints: ["Priority slots"], description: "" },
      });
      expect(patch.ok()).toBeTruthy();
      const patched = (await patch.json()).data;
      expect(patched.keyPoints).toEqual(["Priority slots"]);
      expect(patched.description).toBe("");
      expect(patched.tagline).toBe("Great for city cars");

      const catalog = await request.get(apiUrl("/catalog/plans"));
      const fromCatalog = (await catalog.json()).data.find((p: { id: string }) => p.id === plan.id);
      expect(fromCatalog).toMatchObject({ tagline: "Great for city cars", keyPoints: ["Priority slots"] });
    } finally {
      await request.delete(apiUrl(`/admin/plans/${plan.id}`), { headers: authHeader(token) });
    }
  });

  test("rejects more than 12 key points and over-long copy", async ({ request }) => {
    const { token } = await loginAsAdmin(request);
    const base = { name: `Bad Plan ${Date.now()}`, packageId: "express", discountPercentage: 20, washesPerMonth: 4 };
    const tooMany = await request.post(apiUrl("/admin/plans"), {
      headers: authHeader(token),
      data: { ...base, keyPoints: Array.from({ length: 13 }, (_, i) => `Point ${i}`) },
    });
    expect(tooMany.status()).toBe(400);
    const longTagline = await request.post(apiUrl("/admin/plans"), {
      headers: authHeader(token),
      data: { ...base, tagline: "x".repeat(121) },
    });
    expect(longTagline.status()).toBe(400);
  });
});

test.describe("Admin-set booking notice", () => {
  test("admin sets the notice; it's served publicly and validated", async ({ request }) => {
    const { token } = await loginAsAdmin(request);
    const original = await getSlotConfig(request, token);
    expect(typeof original.leadMinutes).toBe("number");
    try {
      const save = await putSlotConfig(request, token, { slots: original.slots, leadMinutes: 30 });
      expect(save.ok()).toBeTruthy();
      expect((await save.json()).data.leadMinutes).toBe(30);

      const pub = await request.get(apiUrl("/catalog/time-slots"));
      expect((await pub.json()).data.leadMinutes).toBe(30);

      // Saving slots alone leaves the notice as it was.
      const slotsOnly = await putSlotConfig(request, token, { slots: original.slots });
      expect((await slotsOnly.json()).data.leadMinutes).toBe(30);

      expect((await putSlotConfig(request, token, { slots: original.slots, leadMinutes: -5 })).status()).toBe(400);
      expect(
        (await putSlotConfig(request, token, { slots: original.slots, leadMinutes: original.maxLeadMinutes + 1 }))
          .status(),
      ).toBe(400);
    } finally {
      await putSlotConfig(request, token, { slots: original.slots, leadMinutes: original.leadMinutes });
    }
  });

  test("server refuses a slot inside the notice and accepts it once the notice allows it", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const tz = await businessTimezone(request);
    const soon = nowMinutesIn(tz) + 30;
    // Too close to midnight to have a "later today" slot — nothing to test.
    test.skip(soon >= 24 * 60 - 5, "too close to midnight in the business timezone");

    const original = await getSlotConfig(request, adminToken);
    const soonSlot = toSlotLabel(soon);
    const slots = Array.from(new Set([...original.slots, soonSlot]));
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const today = new Date().toISOString();
    try {
      // 2-hour notice: a slot ~30 minutes away is too soon.
      expect((await putSlotConfig(request, adminToken, { slots, leadMinutes: 120 })).ok()).toBeTruthy();
      const refused = await request.post(apiUrl("/bookings"), {
        headers: authHeader(token),
        data: bookingPayload(packageId, { date: today, slot: soonSlot }),
      });
      expect(refused.status()).toBe(400);
      expect((await refused.json()).message).toContain("2 hours");

      // The payment order is refused too, before the customer pays.
      const order = await request.post(apiUrl("/payments/order"), {
        headers: authHeader(token),
        data: { booking: bookingPayload(packageId, { date: today, slot: soonSlot }) },
      });
      expect(order.status()).toBe(400);

      // 15-minute notice: the same slot is fine.
      expect((await putSlotConfig(request, adminToken, { slots, leadMinutes: 15 })).ok()).toBeTruthy();
      const accepted = await request.post(apiUrl("/bookings"), {
        headers: authHeader(token),
        data: bookingPayload(packageId, { date: today, slot: soonSlot }),
      });
      expect(accepted.ok(), await accepted.text()).toBeTruthy();
    } finally {
      await putSlotConfig(request, adminToken, { slots: original.slots, leadMinutes: original.leadMinutes });
    }
  });
});

test.describe("Vehicle colour and number", () => {
  test("a saved vehicle keeps its colour; a bad hex is rejected", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const add = await request.post(apiUrl("/users/me/vehicles"), {
      headers: authHeader(token),
      data: { type: "hatchback", name: "Colour Car", plate: "GJ 01 AB 1234", color: "Pearl White", colorHex: "#f5f5f4" },
    });
    expect(add.ok()).toBeTruthy();
    const vehicle = (await add.json()).data.vehicles.find((v: { name: string }) => v.name === "Colour Car");
    expect(vehicle).toMatchObject({ plate: "GJ 01 AB 1234", color: "Pearl White", colorHex: "#f5f5f4" });

    const bad = await request.post(apiUrl("/users/me/vehicles"), {
      headers: authHeader(token),
      data: { type: "hatchback", name: "Bad Colour", colorHex: "red" },
    });
    expect(bad.status()).toBe(400);
  });

  test("an on-demand booking stores the vehicle number and colour, and admin sees them", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const res = await request.post(apiUrl("/bookings"), {
      headers: authHeader(token),
      data: bookingPayload(packageId, {
        vehiclePlate: "MP 09 XY 4321",
        vehicleColor: "Midnight Blue",
        vehicleColorHex: "#1d4ed8",
      }),
    });
    expect(res.ok()).toBeTruthy();
    const booking = (await res.json()).data;
    expect(booking).toMatchObject({
      vehiclePlate: "MP 09 XY 4321",
      vehicleColor: "Midnight Blue",
      vehicleColorHex: "#1d4ed8",
    });

    const { token: adminToken } = await loginAsAdmin(request);
    const detail = await request.get(apiUrl(`/admin/bookings/${booking.id}`), { headers: authHeader(adminToken) });
    expect(detail.ok()).toBeTruthy();
    expect((await detail.json()).data).toMatchObject({ vehiclePlate: "MP 09 XY 4321", vehicleColor: "Midnight Blue" });
  });

  test("a booking without number or colour still works; a bad colour hex is rejected", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const plain = await request.post(apiUrl("/bookings"), { headers: authHeader(token), data: bookingPayload(packageId) });
    expect(plain.ok()).toBeTruthy();
    expect((await plain.json()).data.vehiclePlate).toBe("");

    const bad = await request.post(apiUrl("/bookings"), {
      headers: authHeader(token),
      data: bookingPayload(packageId, { vehicleColorHex: "#12" }),
    });
    expect(bad.status()).toBe(400);
  });
});

import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi, loginAsNewCustomerApi } from "../fixtures/admin-api-helpers";

/**
 * Peak hours are a single global config, so every test here mutates shared
 * state. The suite runs with workers:1 / fullyParallel:false, so ordering is
 * deterministic — but each describe still resets the config in afterAll so a
 * failure mid-file can't leave peak windows behind for unrelated specs (a
 * stray window would silently change how other coupon tests price a booking).
 */

const IST = "Asia/Kolkata";

/** A date far enough ahead to satisfy the booking-date bounds, as an ISO string. */
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** The weekday index (0 = Sunday) a date falls on in the given zone — mirrors the server. */
function weekdayInZone(iso: string, timeZone = IST): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

async function setPeakHours(
  request: APIRequestContext,
  token: string,
  body: { timezone?: string; active?: boolean; windows?: unknown[] },
) {
  return request.put(apiUrl("/admin/peak-hours"), { headers: authHeader(token), data: body });
}

async function resetPeakHours(request: APIRequestContext, token: string) {
  await setPeakHours(request, token, { timezone: IST, active: true, windows: [] });
}

/** First active package id, needed for any price preview. */
async function firstPackageId(request: APIRequestContext): Promise<string> {
  const res = await request.get(apiUrl("/catalog/packages"));
  return (await res.json()).data[0].id;
}

test.describe("Peak hours — config CRUD", () => {
  test.afterAll(async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    await resetPeakHours(request, token);
  });

  test("GET /admin/peak-hours requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/peak-hours"));
    expect(res.status()).toBe(401);
  });

  test("PUT /admin/peak-hours requires admin auth", async ({ request }) => {
    const res = await request.put(apiUrl("/admin/peak-hours"), { data: { active: false } });
    expect(res.status()).toBe(401);
  });

  test("GET returns a config with a timezone, an active flag and windows", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    await resetPeakHours(request, token);

    const res = await request.get(apiUrl("/admin/peak-hours"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const config = (await res.json()).data;
    expect(config.timezone).toBe(IST);
    expect(config.active).toBe(true);
    expect(Array.isArray(config.windows)).toBe(true);
  });

  test("stores windows and returns them with derived minute offsets", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await setPeakHours(request, token, {
      windows: [{ day: 0, start: "08:00", end: "12:00", label: "Sunday rush" }],
    });
    expect(res.ok()).toBeTruthy();

    const config = (await res.json()).data;
    expect(config.windows).toHaveLength(1);
    expect(config.windows[0]).toMatchObject({
      day: 0,
      start: "08:00",
      end: "12:00",
      label: "Sunday rush",
      startMinutes: 480,
      endMinutes: 720,
    });
  });

  test("sorts windows by day then start time, regardless of submitted order", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await setPeakHours(request, token, {
      windows: [
        { day: 3, start: "17:00", end: "20:00" },
        { day: 0, start: "14:00", end: "16:00" },
        { day: 0, start: "08:00", end: "12:00" },
      ],
    });
    expect(res.ok()).toBeTruthy();
    const windows = (await res.json()).data.windows;
    expect(windows.map((w: { day: number; start: string }) => `${w.day}@${w.start}`)).toEqual([
      "0@08:00",
      "0@14:00",
      "3@17:00",
    ]);
  });

  test("allows back-to-back windows — end is exclusive, so they don't overlap", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await setPeakHours(request, token, {
      windows: [
        { day: 1, start: "10:00", end: "12:00" },
        { day: 1, start: "12:00", end: "14:00" },
      ],
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.windows).toHaveLength(2);
  });

  test("rejects a window that ends before it starts", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await setPeakHours(request, token, {
      windows: [{ day: 0, start: "18:00", end: "09:00" }],
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("end must be after start");
  });

  test("rejects a zero-length window", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await setPeakHours(request, token, {
      windows: [{ day: 2, start: "10:00", end: "10:00" }],
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("end must be after start");
  });

  test("rejects overlapping windows on the same day", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await setPeakHours(request, token, {
      windows: [
        { day: 0, start: "08:00", end: "12:00" },
        { day: 0, start: "11:00", end: "14:00" },
      ],
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("Overlapping peak windows on Sunday");
  });

  test("allows the same clock window on two different days", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await setPeakHours(request, token, {
      windows: [
        { day: 0, start: "08:00", end: "12:00" },
        { day: 6, start: "08:00", end: "12:00" },
      ],
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.windows).toHaveLength(2);
  });

  test("rejects an out-of-range weekday", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await setPeakHours(request, token, {
      windows: [{ day: 7, start: "08:00", end: "12:00" }],
    });
    expect(res.status()).toBe(400);
  });

  test("rejects malformed times", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    for (const bad of ["25:00", "abc", "8:0", "12:60", ""]) {
      const res = await setPeakHours(request, token, {
        windows: [{ day: 0, start: bad, end: "12:00" }],
      });
      expect(res.status(), `start "${bad}" should be rejected`).toBe(400);
    }
  });

  test("rejects an unknown timezone", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await setPeakHours(request, token, { timezone: "Mars/Olympus_Mons" });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("not a recognised IANA timezone");
  });

  test("accepts a real non-default timezone, then restores IST", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await setPeakHours(request, token, { timezone: "Asia/Dubai" });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.timezone).toBe("Asia/Dubai");
    await resetPeakHours(request, token);
  });

  test("a rejected update leaves the previously stored config untouched", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    await setPeakHours(request, token, {
      windows: [{ day: 0, start: "08:00", end: "12:00" }],
    });

    const bad = await setPeakHours(request, token, {
      windows: [{ day: 0, start: "20:00", end: "06:00" }],
    });
    expect(bad.status()).toBe(400);

    const after = await request.get(apiUrl("/admin/peak-hours"), { headers: authHeader(token) });
    const windows = (await after.json()).data.windows;
    expect(windows).toHaveLength(1);
    expect(windows[0].start).toBe("08:00");
  });
});

test.describe("Peak hours — public catalog endpoint", () => {
  test.afterAll(async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    await resetPeakHours(request, token);
  });

  test("GET /catalog/peak-hours is public and reflects the admin config", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    await setPeakHours(request, token, {
      timezone: IST,
      active: true,
      windows: [{ day: 5, start: "18:00", end: "21:00", label: "Friday evening" }],
    });

    // No auth header at all — this must still resolve.
    const res = await request.get(apiUrl("/catalog/peak-hours"));
    expect(res.ok()).toBeTruthy();
    const config = (await res.json()).data;
    expect(config.timezone).toBe(IST);
    expect(config.windows).toHaveLength(1);
    expect(config.windows[0].label).toBe("Friday evening");
  });
});

test.describe("Peak hours — discount code gating", () => {
  // The whole file's coupon logic keys off one target date, so the same weekday
  // is used to build both the peak window and the booking.
  const targetDate = daysFromNow(3);
  const targetDay = weekdayInZone(targetDate);
  const PEAK_SLOT = "11:00 AM"; // 660 minutes
  const OFF_PEAK_SLOT = "05:00 PM"; // 1020 minutes

  let adminToken = "";
  let customerToken = "";
  let packageId = "";
  let peakCode = "";
  let normalCode = "";

  test.beforeAll(async ({ request }) => {
    adminToken = (await loginAsAdminApi(request)).token;
    customerToken = (await loginAsNewCustomerApi(request)).token;
    packageId = await firstPackageId(request);

    // A window that contains PEAK_SLOT but not OFF_PEAK_SLOT, on the target day.
    await setPeakHours(request, adminToken, {
      timezone: IST,
      active: true,
      windows: [{ day: targetDay, start: "10:00", end: "12:00", label: "Test window" }],
    });

    peakCode = `PEAKONLY${Date.now()}`;
    const createPeak = await request.post(apiUrl("/admin/discount-codes"), {
      headers: authHeader(adminToken),
      data: { code: peakCode, type: "flat", value: 50, peakHoursOnly: true },
    });
    expect(createPeak.status()).toBe(201);
    expect((await createPeak.json()).data.peakHoursOnly).toBe(true);

    normalCode = `ANYTIME${Date.now()}`;
    const createNormal = await request.post(apiUrl("/admin/discount-codes"), {
      headers: authHeader(adminToken),
      data: { code: normalCode, type: "flat", value: 50 },
    });
    expect(createNormal.status()).toBe(201);
    expect((await createNormal.json()).data.peakHoursOnly).toBe(false);
  });

  test.afterAll(async ({ request }) => {
    await resetPeakHours(request, adminToken);
  });

  test("applies a peak-only code when the booked slot is inside a peak window", async ({ request }) => {
    const res = await request.post(apiUrl("/payments/preview"), {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "hatchback",
        packageId,
        discountCode: peakCode,
        date: targetDate,
        slot: PEAK_SLOT,
      },
    });
    expect(res.ok()).toBeTruthy();
    const quote = (await res.json()).data;
    expect(quote.discountCode).toBe(peakCode.toUpperCase());
    expect(quote.discountAmount).toBe(50);
  });

  test("rejects a peak-only code when the booked slot is outside every window", async ({ request }) => {
    const res = await request.post(apiUrl("/payments/preview"), {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "hatchback",
        packageId,
        discountCode: peakCode,
        date: targetDate,
        slot: OFF_PEAK_SLOT,
      },
    });
    expect(res.status()).toBe(400);
    const message = (await res.json()).message;
    expect(message).toContain("peak-hour slots");
    // The message should name the windows the customer could move to.
    expect(message).toContain("10:00");
  });

  test("refuses a peak-only code when no slot context is supplied, rather than quoting it", async ({ request }) => {
    const res = await request.post(apiUrl("/payments/preview"), {
      headers: authHeader(customerToken),
      data: { vehicleType: "hatchback", packageId, discountCode: peakCode },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("pick your date and time slot first");
  });

  test("a normal code is unaffected by the slot", async ({ request }) => {
    for (const slot of [PEAK_SLOT, OFF_PEAK_SLOT]) {
      const res = await request.post(apiUrl("/payments/preview"), {
        headers: authHeader(customerToken),
        data: {
          vehicleType: "hatchback",
          packageId,
          discountCode: normalCode,
          date: targetDate,
          slot,
        },
      });
      expect(res.ok(), `normal code should apply on ${slot}`).toBeTruthy();
      expect((await res.json()).data.discountAmount).toBe(50);
    }
  });

  test("a normal code still applies with no slot context at all", async ({ request }) => {
    const res = await request.post(apiUrl("/payments/preview"), {
      headers: authHeader(customerToken),
      data: { vehicleType: "hatchback", packageId, discountCode: normalCode },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.discountAmount).toBe(50);
  });

  test("a peak-only code is rejected on a weekday with no windows configured", async ({ request }) => {
    // Same clock slot, but seven days later is the same weekday — so shift by
    // one day to land on a weekday the config leaves off-peak.
    const otherDay = daysFromNow(4);
    test.skip(weekdayInZone(otherDay) === targetDay, "adjacent day resolved to the same weekday");

    const res = await request.post(apiUrl("/payments/preview"), {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "hatchback",
        packageId,
        discountCode: peakCode,
        date: otherDay,
        slot: PEAK_SLOT,
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("no peak hours configured");
  });

  test("turning the master switch off disables a peak-only code even on a peak slot", async ({ request }) => {
    await setPeakHours(request, adminToken, { active: false });

    const res = await request.post(apiUrl("/payments/preview"), {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "hatchback",
        packageId,
        discountCode: peakCode,
        date: targetDate,
        slot: PEAK_SLOT,
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("paused");

    // Restore for the tests that follow.
    await setPeakHours(request, adminToken, { active: true });
  });

  test("booking creation refuses a peak-only code on an off-peak slot, and creates nothing", async ({ request }) => {
    const before = await request.get(apiUrl("/bookings"), { headers: authHeader(customerToken) });
    const countBefore = (await before.json()).data.length;

    const res = await request.post(apiUrl("/payments/verify"), {
      headers: authHeader(customerToken),
      data: {
        booking: {
          vehicleType: "hatchback",
          vehicleName: "Test Car",
          packageId,
          date: targetDate,
          slot: OFF_PEAK_SLOT,
          addressLabel: "Home",
          addressLine: "123 Test Street",
          discountCode: peakCode,
        },
      },
    });
    expect(res.status()).toBe(400);

    const after = await request.get(apiUrl("/bookings"), { headers: authHeader(customerToken) });
    expect((await after.json()).data.length).toBe(countBefore);
  });

  test("booking creation accepts a peak-only code on a peak slot and charges the discounted price", async ({ request }) => {
    const quoteRes = await request.post(apiUrl("/payments/preview"), {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "hatchback",
        packageId,
        discountCode: peakCode,
        date: targetDate,
        slot: PEAK_SLOT,
      },
    });
    const quoted = (await quoteRes.json()).data.price;

    const res = await request.post(apiUrl("/payments/verify"), {
      headers: authHeader(customerToken),
      data: {
        booking: {
          vehicleType: "hatchback",
          vehicleName: "Test Car",
          packageId,
          date: targetDate,
          slot: PEAK_SLOT,
          addressLabel: "Home",
          addressLine: "123 Test Street",
          discountCode: peakCode,
        },
      },
    });
    expect(res.status()).toBe(201);
    const booking = (await res.json()).data;
    expect(booking.discountCode).toBe(peakCode.toUpperCase());
    expect(booking.discountAmount).toBe(50);
    // The quote the customer saw is exactly what the booking was created at.
    expect(booking.price).toBe(quoted);
  });
});

test.describe("Peak hours — special coupon gating", () => {
  const targetDate = daysFromNow(3);
  const targetDay = weekdayInZone(targetDate);
  const PEAK_SLOT = "11:00 AM";
  const OFF_PEAK_SLOT = "05:00 PM";

  let adminToken = "";
  let customerToken = "";
  let packageId = "";
  let couponCode = "";

  test.beforeAll(async ({ request }) => {
    adminToken = (await loginAsAdminApi(request)).token;
    const customer = await loginAsNewCustomerApi(request);
    customerToken = customer.token;
    packageId = await firstPackageId(request);

    await setPeakHours(request, adminToken, {
      timezone: IST,
      active: true,
      windows: [{ day: targetDay, start: "10:00", end: "12:00" }],
    });

    const generated = await request.post(apiUrl("/admin/special-coupons/generate"), {
      headers: authHeader(adminToken),
      data: { count: 1, type: "flat", value: 40, peakHoursOnly: true },
    });
    expect(generated.status()).toBe(201);
    const coupon = (await generated.json()).data[0];
    expect(coupon.peakHoursOnly).toBe(true);
    couponCode = coupon.code;

    const assign = await request.patch(apiUrl(`/admin/special-coupons/${coupon.id}/assign`), {
      headers: authHeader(adminToken),
      data: { customerId: customer.userId },
    });
    expect(assign.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    await resetPeakHours(request, adminToken);
  });

  test("a peak-only special coupon applies on a peak slot", async ({ request }) => {
    const res = await request.post(apiUrl("/payments/preview"), {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "hatchback",
        packageId,
        discountCode: couponCode,
        date: targetDate,
        slot: PEAK_SLOT,
      },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.discountAmount).toBe(40);
  });

  test("a peak-only special coupon is refused on an off-peak slot", async ({ request }) => {
    const res = await request.post(apiUrl("/payments/preview"), {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "hatchback",
        packageId,
        discountCode: couponCode,
        date: targetDate,
        slot: OFF_PEAK_SLOT,
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("peak-hour slots");
  });
});

test.describe("Promo banners — type field", () => {
  test("a banner round-trips its type, and defaults to promotional", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);

    const typed = await request.post(apiUrl("/admin/promo-banners"), {
      headers: authHeader(token),
      data: {
        title: `Peak banner ${Date.now()}`,
        imageUrl: "https://example.com/peak.png",
        type: "peak-hours",
      },
    });
    expect(typed.status()).toBe(201);
    const typedBanner = (await typed.json()).data;
    expect(typedBanner.type).toBe("peak-hours");

    const untyped = await request.post(apiUrl("/admin/promo-banners"), {
      headers: authHeader(token),
      data: { title: `Plain banner ${Date.now()}`, imageUrl: "https://example.com/plain.png" },
    });
    const untypedBanner = (await untyped.json()).data;
    expect(untypedBanner.type).toBe("promotional");

    // The public feed carries the type through to the customer app.
    const publicRes = await request.get(apiUrl("/catalog/promo-banners"));
    const feed = (await publicRes.json()).data as { id: string; type: string }[];
    expect(feed.find((b) => b.id === typedBanner.id)?.type).toBe("peak-hours");

    for (const id of [typedBanner.id, untypedBanner.id]) {
      await request.delete(apiUrl(`/admin/promo-banners/${id}`), { headers: authHeader(token) });
    }
  });

  test("rejects an unknown banner type", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/promo-banners"), {
      headers: authHeader(token),
      data: { title: "Bad type", imageUrl: "https://example.com/x.png", type: "not-a-type" },
    });
    expect(res.status()).toBe(400);
  });
});

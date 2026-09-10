import { test, expect, type APIRequestContext } from "../fixtures/base";
import { authHeader, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";
import { cancelTestBookings } from "../fixtures/booking-cleanup";

/**
 * Admin-initiated moves obey the same pricing as a customer's, unless waived.
 *
 * Without that an admin reschedule would be a free bypass of the whole off-peak
 * rule — and the easiest one to ask support for. The waiver exists because
 * goodwill moves are a real need, but it is recorded rather than silent: "why is
 * this booking in a peak slot at the off-peak price?" should have an answer.
 */

const IST = "Asia/Kolkata";
const DISCOUNTED_SLOT = "11:00 AM";
const FULL_PRICE_SLOT = "05:00 PM";
const FEE = 100;
const RECLAIM = 150;

const ALL_DAY_WINDOWS = Array.from({ length: 7 }, (_, day) => ({
  day,
  start: "10:00",
  end: "12:00",
  label: "Waiver test window",
}));

const futureDate = (days = 3) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

type AdminBookingRow = {
  id: string;
  price: number;
  slot: string;
  offPeakLocked: boolean;
  offPeakDiscountAmount: number;
};

async function configure(request: APIRequestContext, adminToken: string, windows: unknown[]) {
  const res = await request.put("/admin/off-peak-hours", {
    headers: authHeader(adminToken),
    data: { timezone: IST, active: true, windows, peakUpgradeFee: FEE },
  });
  expect(res.ok()).toBeTruthy();
}

async function subsidisedBooking(request: APIRequestContext, adminToken: string, packageId: string) {
  const code = `WAIV${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await request.post("/admin/discount-codes", {
    headers: authHeader(adminToken),
    data: { code, type: "flat", value: RECLAIM, offPeakOnly: true },
  });

  const { token } = await loginAsNewCustomer(request);
  const res = await request.post("/payments/verify", {
    headers: authHeader(token),
    data: {
      booking: {
        vehicleType: "hatchback",
        vehicleName: "Waiver Test Car",
        packageId,
        date: futureDate(),
        slot: DISCOUNTED_SLOT,
        addressLabel: "Home",
        addressLine: "1 Waiver Street",
        discountCode: code,
      },
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data as { id: string; price: number };
}

async function adminRow(
  request: APIRequestContext,
  adminToken: string,
  id: string,
): Promise<AdminBookingRow> {
  const rows = (await (await request.get("/admin/bookings", { headers: authHeader(adminToken) })).json())
    .data as AdminBookingRow[];
  return rows.find((b) => b.id === id)!;
}

test.describe("Admin reschedule — charge and waiver", () => {
  let adminToken = "";
  let packageId = "";

  test.beforeAll(async ({ request }) => {
    adminToken = (await loginAsAdmin(request)).token;
    packageId = (await (await request.get("/catalog/packages")).json()).data[0].id;
  });

  test.beforeEach(async ({ request }) => {
    await configure(request, adminToken, ALL_DAY_WINDOWS);
  });

  test.afterAll(async ({ request }) => {
    await cancelTestBookings(request, adminToken, "Waiver Test Car");
    await configure(request, adminToken, []);
  });

  test("an admin move into a peak slot charges by default", async ({ request }) => {
    const booking = await subsidisedBooking(request, adminToken, packageId);
    const basePrice = booking.price + RECLAIM;

    const res = await request.patch(`/admin/bookings/${booking.id}/reschedule`, {
      headers: authHeader(adminToken),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT },
    });
    expect(res.ok(), `admin reschedule failed: ${await res.text()}`).toBeTruthy();

    const after = await adminRow(request, adminToken, booking.id);
    expect(after.slot).toBe(FULL_PRICE_SLOT);
    expect(after.price, "the reclaimed subsidy returns the price to base").toBe(basePrice);
    expect(after.offPeakLocked).toBe(false);
  });

  test("waiving moves it at the discounted price, and clears the lock", async ({ request }) => {
    const booking = await subsidisedBooking(request, adminToken, packageId);

    const res = await request.patch(`/admin/bookings/${booking.id}/reschedule`, {
      headers: authHeader(adminToken),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT, waiveUpgrade: true },
    });
    expect(res.ok()).toBeTruthy();

    const after = await adminRow(request, adminToken, booking.id);
    expect(after.slot).toBe(FULL_PRICE_SLOT);
    expect(after.price, "a waived move must not change what the customer pays").toBe(booking.price);
    // The subsidy is written off, so a later move must not try to reclaim it again.
    expect(after.offPeakLocked).toBe(false);
    expect(after.offPeakDiscountAmount).toBe(0);
  });

  test("an admin move between off-peak slots is free either way", async ({ request }) => {
    const booking = await subsidisedBooking(request, adminToken, packageId);

    const res = await request.patch(`/admin/bookings/${booking.id}/reschedule`, {
      headers: authHeader(adminToken),
      data: { date: futureDate(4), slot: DISCOUNTED_SLOT },
    });
    expect(res.ok()).toBeTruthy();

    const after = await adminRow(request, adminToken, booking.id);
    expect(after.price).toBe(booking.price);
    expect(after.offPeakLocked, "still subsidised, so still locked").toBe(true);
  });

  test("an unsubsidised booking is never charged by an admin move", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const created = await request.post("/payments/verify", {
      headers: authHeader(token),
      data: {
        booking: {
          vehicleType: "hatchback",
          vehicleName: "Waiver Test Car",
          packageId,
          date: futureDate(),
          slot: FULL_PRICE_SLOT,
          addressLabel: "Home",
          addressLine: "1 Waiver Street",
        },
      },
    });
    const booking = (await created.json()).data as { id: string; price: number };

    await request.patch(`/admin/bookings/${booking.id}/reschedule`, {
      headers: authHeader(adminToken),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT },
    });

    const after = await adminRow(request, adminToken, booking.id);
    expect(after.price).toBe(booking.price);
  });

  test("the quote endpoint agrees with what the move actually does", async ({ request }) => {
    const booking = await subsidisedBooking(request, adminToken, packageId);

    const quoted = (await (
      await request.post(`/admin/bookings/${booking.id}/reschedule/quote`, {
        headers: authHeader(adminToken),
        data: { date: futureDate(4), slot: FULL_PRICE_SLOT },
      })
    ).json()).data as { newPrice: number; totalDue: number };

    await request.patch(`/admin/bookings/${booking.id}/reschedule`, {
      headers: authHeader(adminToken),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT },
    });

    const after = await adminRow(request, adminToken, booking.id);
    expect(after.price, "the preview must predict the committed price").toBe(quoted.newPrice);
  });
});

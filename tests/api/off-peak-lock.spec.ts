import { test, expect, type APIRequestContext } from "../fixtures/base";
import { authHeader, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";
import { cancelTestBookings } from "../fixtures/booking-cleanup";

/**
 * The reclaim snapshot taken when a booking is created.
 *
 * A booking that only got its price by sitting in a quiet slot has to remember
 * how much that was worth, because the reschedule rules later reclaim exactly
 * that number. Recomputing it at reschedule time would be wrong twice over: the
 * coupon may have been edited or deleted by then, and a percentage coupon
 * re-evaluated against a changed base price would take back an amount the
 * customer was never given.
 *
 * The other half of the contract is what must NOT end up in the snapshot —
 * general coupons and redeemed coins — since those are never clawed back.
 */

const IST = "Asia/Kolkata";
const DISCOUNTED_SLOT = "11:00 AM"; // inside the window configured below
const FULL_PRICE_SLOT = "05:00 PM"; // outside it

/** Every weekday carries the same window, so the booking date never matters. */
const ALL_DAY_WINDOWS = Array.from({ length: 7 }, (_, day) => ({
  day,
  start: "10:00",
  end: "12:00",
  label: "Lock test window",
}));

type BookingRow = {
  id: string;
  price: number;
  discountAmount: number;
  coinDiscount: number;
  offPeakLocked: boolean;
  offPeakDiscountAmount: number;
};

async function setWindows(request: APIRequestContext, adminToken: string, windows: unknown[]) {
  const res = await request.put("/admin/off-peak-hours", {
    headers: authHeader(adminToken),
    data: { timezone: IST, active: true, windows },
  });
  expect(res.ok(), `off-peak config update failed: ${await res.text()}`).toBeTruthy();
}

async function firstPackageId(request: APIRequestContext): Promise<string> {
  return (await (await request.get("/catalog/packages")).json()).data[0].id;
}

async function makeCode(
  request: APIRequestContext,
  adminToken: string,
  body: Record<string, unknown>,
): Promise<string> {
  const code = `LOCK${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const res = await request.post("/admin/discount-codes", {
    headers: authHeader(adminToken),
    data: { code, ...body },
  });
  expect(res.status(), `code create failed: ${await res.text()}`).toBe(201);
  return code;
}

/** Books through the same endpoint the app uses, and returns the stored row. */
async function book(
  request: APIRequestContext,
  customerToken: string,
  packageId: string,
  slot: string,
  extra: Record<string, unknown> = {},
): Promise<BookingRow> {
  const res = await request.post("/payments/verify", {
    headers: authHeader(customerToken),
    data: {
      booking: {
        vehicleType: "hatchback",
        vehicleName: "Lock Test Car",
        packageId,
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        slot,
        addressLabel: "Home",
        addressLine: "1 Lock Street",
        ...extra,
      },
    },
  });
  expect(res.status(), `booking failed: ${await res.text()}`).toBe(201);
  return (await res.json()).data as BookingRow;
}

test.describe("Off-peak lock snapshot", () => {
  let adminToken = "";
  let packageId = "";

  test.beforeAll(async ({ request }) => {
    adminToken = (await loginAsAdmin(request)).token;
    packageId = await firstPackageId(request);
  });

  test.beforeEach(async ({ request }) => {
    await setWindows(request, adminToken, ALL_DAY_WINDOWS);
  });

  test.afterAll(async ({ request }) => {
    // Take these out of the dispatch queue — see booking-cleanup.
    await cancelTestBookings(request, adminToken, "Lock Test Car");
    await setWindows(request, adminToken, []);
  });

  test("an off-peak coupon locks the booking and records what it was worth", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await makeCode(request, adminToken, { type: "flat", value: 60, offPeakOnly: true });

    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, { discountCode: code });

    expect(booking.offPeakLocked).toBe(true);
    expect(booking.offPeakDiscountAmount).toBe(60);
    expect(booking.discountAmount).toBe(60);
  });

  test("a general coupon discounts the booking without locking it", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await makeCode(request, adminToken, { type: "flat", value: 60 });

    // Same quiet slot — it is the coupon, not the hour, that creates the lock.
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, { discountCode: code });

    expect(booking.discountAmount).toBe(60);
    expect(booking.offPeakLocked).toBe(false);
    expect(booking.offPeakDiscountAmount).toBe(0);
  });

  test("a booking with no coupon at all is never locked", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);

    const offPeak = await book(request, token, packageId, DISCOUNTED_SLOT);
    const peak = await book(request, token, packageId, FULL_PRICE_SLOT);

    for (const booking of [offPeak, peak]) {
      expect(booking.offPeakLocked).toBe(false);
      expect(booking.offPeakDiscountAmount).toBe(0);
    }
  });

  test("a percentage coupon snapshots rupees, not the percentage", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await makeCode(request, adminToken, { type: "percent", value: 20, offPeakOnly: true });

    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, { discountCode: code });

    expect(booking.offPeakLocked).toBe(true);
    // Whatever 20% resolved to, the stored figure is that rupee amount and
    // matches the discount actually granted — so a later base-price change
    // cannot move the reclaim.
    expect(booking.offPeakDiscountAmount).toBe(booking.discountAmount);
    expect(booking.offPeakDiscountAmount).toBeGreaterThan(0);
  });

  test("the snapshot survives the coupon being deleted afterwards", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await makeCode(request, adminToken, { type: "flat", value: 45, offPeakOnly: true });

    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, { discountCode: code });
    expect(booking.offPeakDiscountAmount).toBe(45);

    const codes = (await (await request.get("/admin/discount-codes", { headers: authHeader(adminToken) })).json())
      .data as Array<{ id: string; code: string }>;
    const created = codes.find((c) => c.code === code.toUpperCase());
    await request.delete(`/admin/discount-codes/${created!.id}`, { headers: authHeader(adminToken) });

    const mine = (await (await request.get("/bookings", { headers: authHeader(token) })).json())
      .data as BookingRow[];
    const stored = mine.find((b) => b.id === booking.id);
    expect(stored?.offPeakDiscountAmount, "the reclaim figure must not depend on the coupon still existing").toBe(45);
  });

  test("the lock is visible to admins on the bookings list", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await makeCode(request, adminToken, { type: "flat", value: 35, offPeakOnly: true });
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, { discountCode: code });

    const rows = (await (await request.get("/admin/bookings", { headers: authHeader(adminToken) })).json())
      .data as Array<{ id: string; offPeakLocked: boolean; offPeakDiscountAmount: number }>;
    const row = rows.find((b) => b.id === booking.id);
    expect(row?.offPeakLocked).toBe(true);
    expect(row?.offPeakDiscountAmount).toBe(35);
  });
});

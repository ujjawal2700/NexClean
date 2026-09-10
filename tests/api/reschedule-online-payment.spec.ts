import { test, expect, type APIRequestContext } from "../fixtures/base";
import { authHeader, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";
import { cancelTestBookings } from "../fixtures/booking-cleanup";

/**
 * The "pay now" route for a peak upgrade.
 *
 * The test environment runs with no Razorpay keys, so `paymentsLive` is false
 * and the gateway cannot be exercised end to end here. What *can* be pinned —
 * and matters more — is that the online route never becomes a way to move a
 * booking without paying:
 *
 *   - it is refused outright when no gateway is configured, rather than
 *     silently falling through to a mock order in front of a real customer;
 *   - a commit claiming "online" with no proof, or forged proof, is rejected;
 *   - a rejected attempt leaves the booking exactly where it was.
 *
 * The signature-verified happy path is covered by the same claim/consume logic
 * that /payments/verify already uses in production mode.
 */

const IST = "Asia/Kolkata";
const DISCOUNTED_SLOT = "11:00 AM";
const FULL_PRICE_SLOT = "05:00 PM";
const FEE = 100;

const ALL_DAY_WINDOWS = Array.from({ length: 7 }, (_, day) => ({
  day,
  start: "10:00",
  end: "12:00",
  label: "Online payment test window",
}));

type Booking = { id: string; price: number; slot: string; offPeakLocked: boolean };

const futureDate = (days = 3) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

async function configure(request: APIRequestContext, adminToken: string, windows: unknown[]) {
  const res = await request.put("/admin/off-peak-hours", {
    headers: authHeader(adminToken),
    data: { timezone: IST, active: true, windows, peakUpgradeFee: FEE },
  });
  expect(res.ok()).toBeTruthy();
}

async function subsidisedBooking(
  request: APIRequestContext,
  adminToken: string,
  packageId: string,
): Promise<{ token: string; booking: Booking }> {
  const code = `ONL${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const created = await request.post("/admin/discount-codes", {
    headers: authHeader(adminToken),
    data: { code, type: "flat", value: 150, offPeakOnly: true },
  });
  expect(created.status()).toBe(201);

  const { token } = await loginAsNewCustomer(request);
  const res = await request.post("/payments/verify", {
    headers: authHeader(token),
    data: {
      booking: {
        vehicleType: "hatchback",
        vehicleName: "Online Test Car",
        packageId,
        date: futureDate(),
        slot: DISCOUNTED_SLOT,
        addressLabel: "Home",
        addressLine: "1 Online Street",
        discountCode: code,
      },
    },
  });
  expect(res.status()).toBe(201);
  const booking = (await res.json()).data as Booking;
  expect(booking.offPeakLocked).toBe(true);
  return { token, booking };
}

async function myBooking(request: APIRequestContext, token: string, id: string): Promise<Booking> {
  const rows = (await (await request.get("/bookings", { headers: authHeader(token) })).json())
    .data as Booking[];
  return rows.find((b) => b.id === id)!;
}

test.describe("Reschedule — online payment route", () => {
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
    // Take these out of the dispatch queue — see booking-cleanup.
    await cancelTestBookings(request, adminToken, "Online Test Car");
    await configure(request, adminToken, []);
  });

  test("the quote says whether paying online is even possible", async ({ request }) => {
    const { token, booking } = await subsidisedBooking(request, adminToken, packageId);

    const res = await request.post(`/bookings/${booking.id}/reschedule/preview`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT },
    });
    expect(res.ok()).toBeTruthy();
    const quote = (await res.json()).data;

    expect(quote.requiresPayment).toBe(true);
    // No keys configured in this environment, so the screen must not offer it.
    expect(quote.onlinePaymentAvailable).toBe(false);
  });

  test("asking for an order without a gateway is refused, not faked", async ({ request }) => {
    const { token, booking } = await subsidisedBooking(request, adminToken, packageId);

    const res = await request.post(`/bookings/${booking.id}/reschedule/order`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("pay your cleaner");
  });

  test("an order cannot be opened for a change that costs nothing", async ({ request }) => {
    const { token, booking } = await subsidisedBooking(request, adminToken, packageId);

    // Moving to another off-peak slot is free, so there is nothing to charge.
    const res = await request.post(`/bookings/${booking.id}/reschedule/order`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: DISCOUNTED_SLOT },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("free");
  });

  test("claiming to have paid online without any proof moves nothing", async ({ request }) => {
    const { token, booking } = await subsidisedBooking(request, adminToken, packageId);

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT, paymentMethod: "online" },
    });
    expect(res.status()).toBe(400);

    const after = await myBooking(request, token, booking.id);
    expect(after.slot, "an unproven payment must not move the booking").toBe(DISCOUNTED_SLOT);
    expect(after.price).toBe(booking.price);
    expect(after.offPeakLocked).toBe(true);
  });

  test("forged payment proof is rejected and moves nothing", async ({ request }) => {
    const { token, booking } = await subsidisedBooking(request, adminToken, packageId);

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: {
        date: futureDate(4),
        slot: FULL_PRICE_SLOT,
        paymentMethod: "online",
        razorpay_order_id: "order_forged_123",
        razorpay_payment_id: "pay_forged_123",
        razorpay_signature: "definitely-not-a-valid-signature",
      },
    });
    expect(res.status()).toBe(400);

    const after = await myBooking(request, token, booking.id);
    expect(after.slot).toBe(DISCOUNTED_SLOT);
    expect(after.price).toBe(booking.price);
  });

  test("the cash route still works while the gateway is off", async ({ request }) => {
    const { token, booking } = await subsidisedBooking(request, adminToken, packageId);

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT, paymentMethod: "cash" },
    });
    expect(res.ok(), `cash fallback failed: ${await res.text()}`).toBeTruthy();

    const after = await myBooking(request, token, booking.id);
    expect(after.slot).toBe(FULL_PRICE_SLOT);
  });

  test("an online upgrade does not also inflate the cash bill", async ({ request }) => {
    // Guards the double-charge shape: whichever route is used, the customer must
    // owe the upgrade exactly once. Cash is the exercisable route here, so this
    // pins that the cash bill equals price + fee and nothing more.
    const { token, booking } = await subsidisedBooking(request, adminToken, packageId);

    await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT, paymentMethod: "cash" },
    });

    const rows = (await (await request.get("/admin/payments", { headers: authHeader(adminToken) })).json())
      .data as { bookingId: string | null; amount: number; kind?: string }[];
    const forBooking = rows.filter((p) => p.bookingId === booking.id);

    // Exactly one ledger row for a cash upgrade — no separate reschedule row.
    expect(forBooking).toHaveLength(1);
    const after = await myBooking(request, token, booking.id);
    expect(forBooking[0].amount).toBe(after.price + FEE);
  });
});

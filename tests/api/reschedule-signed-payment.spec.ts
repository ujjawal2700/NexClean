import crypto from "node:crypto";
import { test, expect, type APIRequestContext } from "../fixtures/base";
import { authHeader, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";
import { cancelTestBookings } from "../fixtures/booking-cleanup";
import { mongoEval } from "../fixtures/mongo";

/**
 * The verified-signature half of the online upgrade route.
 *
 * Only Razorpay can mint a real order, so the happy path looked untestable and
 * was left uncovered — which is the wrong place to have a gap, because this is
 * the code that decides whether a payment actually moves a booking.
 *
 * It is reachable after all: signature verification is an HMAC over
 * `order_id|payment_id` keyed on the configured secret, and this environment
 * runs with an empty secret. An empty key still produces a deterministic HMAC,
 * so a test can construct genuinely valid proof for a row it seeded. Nothing in
 * the application is bent to make this work — the same verify-and-claim code
 * runs as in production.
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
  label: "Signed payment window",
}));

const futureDate = (days = 3) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

/** The signature Razorpay would send, computed with the same secret the server verifies against. */
function sign(orderId: string, paymentId: string, secret = process.env.RAZORPAY_KEY_SECRET ?? ""): string {
  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

type Booking = {
  id: string;
  price: number;
  slot: string;
  offPeakLocked: boolean;
  peakUpgradeFeeCharged: number;
};

async function configure(request: APIRequestContext, adminToken: string, windows: unknown[]) {
  const res = await request.put("/admin/off-peak-hours", {
    headers: authHeader(adminToken),
    data: { timezone: IST, active: true, windows, peakUpgradeFee: FEE },
  });
  expect(res.ok()).toBeTruthy();
}

async function subsidisedBooking(request: APIRequestContext, adminToken: string, packageId: string) {
  const code = `SIGN${Date.now()}${Math.floor(Math.random() * 1000)}`;
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
        vehicleName: "Signed Test Car",
        packageId,
        date: futureDate(),
        slot: DISCOUNTED_SLOT,
        addressLabel: "Home",
        addressLine: "1 Signed Street",
        discountCode: code,
      },
    },
  });
  expect(res.status()).toBe(201);
  return { token, booking: (await res.json()).data as Booking };
}

/** Seed the ledger row Razorpay's order call would have created. */
function seedRescheduleOrder(opts: {
  bookingId: string;
  userId: string;
  orderId: string;
  date: string;
  slot: string;
  reclaim: number;
  fee: number;
}) {
  mongoEval(`
    db.payments.insertOne({
      user: ObjectId("${opts.userId}"),
      booking: ObjectId("${opts.bookingId}"),
      orderId: "${opts.orderId}",
      paymentId: null,
      amount: ${opts.reclaim + opts.fee},
      currency: "INR",
      status: "created",
      kind: "reschedule",
      rescheduleIntent: {
        date: new Date("${opts.date}"),
        slot: "${opts.slot}",
        reclaim: ${opts.reclaim},
        fee: ${opts.fee},
        totalDue: ${opts.reclaim + opts.fee}
      },
      refundAmount: 0, agentPayout: 0, settlementStatus: "pending",
      createdAt: new Date(), updatedAt: new Date()
    });
  `);
}

async function myBooking(request: APIRequestContext, token: string, id: string): Promise<Booking> {
  const rows = (await (await request.get("/bookings", { headers: authHeader(token) })).json())
    .data as Booking[];
  return rows.find((b) => b.id === id)!;
}

test.describe("Reschedule — verified online payment", () => {
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
    await cancelTestBookings(request, adminToken, "Signed Test Car");
    await configure(request, adminToken, []);
  });

  test("valid proof moves the booking and settles at base price plus the fee", async ({ request }) => {
    const { token, booking } = await subsidisedBooking(request, adminToken, packageId);
    const { userId } = await (async () => {
      const me = await (await request.get("/auth/me", { headers: authHeader(token) })).json();
      return { userId: me.data.id as string };
    })();
    const basePrice = booking.price + RECLAIM;

    const orderId = `order_signed_${Date.now()}`;
    const paymentId = `pay_signed_${Date.now()}`;
    const targetDate = futureDate(4);
    seedRescheduleOrder({
      bookingId: booking.id,
      userId,
      orderId,
      date: targetDate,
      slot: FULL_PRICE_SLOT,
      reclaim: RECLAIM,
      fee: FEE,
    });

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: {
        date: targetDate,
        slot: FULL_PRICE_SLOT,
        paymentMethod: "online",
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sign(orderId, paymentId),
      },
    });
    expect(res.ok(), `signed reschedule failed: ${await res.text()}`).toBeTruthy();

    const after = await myBooking(request, token, booking.id);
    expect(after.slot).toBe(FULL_PRICE_SLOT);
    expect(after.price, "service value returns to base").toBe(basePrice);
    expect(after.peakUpgradeFeeCharged).toBe(FEE);
    expect(after.offPeakLocked).toBe(false);

    // The upgrade row is consumed, and the cash row is NOT also inflated —
    // the customer must owe the upgrade exactly once.
    const rows = (await (await request.get("/admin/payments", { headers: authHeader(adminToken) })).json())
      .data as { bookingId: string | null; amount: number; status: string }[];
    const forBooking = rows.filter((p) => p.bookingId === booking.id);
    expect(forBooking).toHaveLength(2);
    const upgrade = forBooking.find((p) => p.amount === RECLAIM + FEE);
    expect(upgrade?.status, "the upgrade payment is consumed").toBe("paid");
    const cashRow = forBooking.find((p) => p.amount !== RECLAIM + FEE);
    expect(cashRow?.amount, "the cash bill must be untouched by an online upgrade").toBe(booking.price);
  });

  /**
   * One payment upgrades one booking.
   *
   * Note what is NOT the risk here: replaying the proof against the *same*
   * booking is harmless, because the first upgrade repays the subsidy and every
   * later move on that booking is genuinely free — nothing is claimed because
   * nothing is owed. The real exposure is a customer with two discounted
   * bookings paying once and upgrading both, which the claim's `booking` filter
   * is what prevents.
   */
  test("one payment cannot upgrade a second, different booking", async ({ request }) => {
    const { token, booking: first } = await subsidisedBooking(request, adminToken, packageId);
    const me = await (await request.get("/auth/me", { headers: authHeader(token) })).json();

    // A second discounted booking for the same customer.
    const code = `SIGN2${Date.now()}`;
    await request.post("/admin/discount-codes", {
      headers: authHeader(adminToken),
      data: { code, type: "flat", value: RECLAIM, offPeakOnly: true },
    });
    const createdSecond = await request.post("/payments/verify", {
      headers: authHeader(token),
      data: {
        booking: {
          vehicleType: "hatchback",
          vehicleName: "Signed Test Car",
          packageId,
          date: futureDate(),
          slot: DISCOUNTED_SLOT,
          addressLabel: "Home",
          addressLine: "1 Signed Street",
          discountCode: code,
        },
      },
    });
    const second = (await createdSecond.json()).data as Booking;

    // Paid for the FIRST booking only.
    const orderId = `order_cross_${Date.now()}`;
    const paymentId = `pay_cross_${Date.now()}`;
    const targetDate = futureDate(4);
    seedRescheduleOrder({
      bookingId: first.id,
      userId: me.data.id,
      orderId,
      date: targetDate,
      slot: FULL_PRICE_SLOT,
      reclaim: RECLAIM,
      fee: FEE,
    });

    const proof = {
      paymentMethod: "online" as const,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(orderId, paymentId),
    };

    // Spending it on the other booking must fail...
    const stolen = await request.patch(`/bookings/${second.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: targetDate, slot: FULL_PRICE_SLOT, ...proof },
    });
    expect(stolen.status()).toBe(400);
    const untouched = await myBooking(request, token, second.id);
    expect(untouched.slot, "the second booking must not move on someone else's receipt").toBe(
      DISCOUNTED_SLOT,
    );

    // ...while the booking it was actually bought for still works.
    const legit = await request.patch(`/bookings/${first.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: targetDate, slot: FULL_PRICE_SLOT, ...proof },
    });
    expect(legit.ok(), `the rightful upgrade should still succeed: ${await legit.text()}`).toBeTruthy();
  });

  test("proof bought for one slot cannot be spent on another", async ({ request }) => {
    const { token, booking } = await subsidisedBooking(request, adminToken, packageId);
    const me = await (await request.get("/auth/me", { headers: authHeader(token) })).json();

    const orderId = `order_swap_${Date.now()}`;
    const paymentId = `pay_swap_${Date.now()}`;
    const paidForDate = futureDate(4);
    seedRescheduleOrder({
      bookingId: booking.id,
      userId: me.data.id,
      orderId,
      date: paidForDate,
      slot: FULL_PRICE_SLOT,
      reclaim: RECLAIM,
      fee: FEE,
    });

    // Same valid signature, different day than the one paid for.
    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: {
        date: futureDate(6),
        slot: FULL_PRICE_SLOT,
        paymentMethod: "online",
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sign(orderId, paymentId),
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("different date or time");

    const after = await myBooking(request, token, booking.id);
    expect(after.slot, "a mismatched receipt must not move the booking").toBe(DISCOUNTED_SLOT);
  });

  test("another customer's payment cannot move this booking", async ({ request }) => {
    const { token, booking } = await subsidisedBooking(request, adminToken, packageId);
    const stranger = await loginAsNewCustomer(request);
    const strangerMe = await (await request.get("/auth/me", { headers: authHeader(stranger.token) })).json();

    const orderId = `order_other_${Date.now()}`;
    const paymentId = `pay_other_${Date.now()}`;
    const targetDate = futureDate(4);
    // Paid for by someone else entirely.
    seedRescheduleOrder({
      bookingId: booking.id,
      userId: strangerMe.data.id,
      orderId,
      date: targetDate,
      slot: FULL_PRICE_SLOT,
      reclaim: RECLAIM,
      fee: FEE,
    });

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: {
        date: targetDate,
        slot: FULL_PRICE_SLOT,
        paymentMethod: "online",
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sign(orderId, paymentId),
      },
    });
    expect(res.status()).toBe(400);

    const after = await myBooking(request, token, booking.id);
    expect(after.slot).toBe(DISCOUNTED_SLOT);
  });
});

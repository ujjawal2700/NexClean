import { test, expect, type APIRequestContext } from "../fixtures/base";
import { authHeader, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";
import { cancelTestBookings } from "../fixtures/booking-cleanup";

/**
 * The customer-facing reschedule flow.
 *
 * This is the flow the whole off-peak lock exists to police: it is the one that
 * would let someone buy a cheap quiet slot and walk it into a busy one. The
 * cases below cover the guardrails, the free moves, and the paid upgrade —
 * including the part that matters most, that the slot does not move when the
 * money has not been settled.
 */

const IST = "Asia/Kolkata";
const DISCOUNTED_SLOT = "11:00 AM";
const FULL_PRICE_SLOT = "05:00 PM";
const FEE = 100;

const ALL_DAY_WINDOWS = Array.from({ length: 7 }, (_, day) => ({
  day,
  start: "10:00",
  end: "12:00",
  label: "Reschedule test window",
}));

type Booking = {
  id: string;
  price: number;
  slot: string;
  date: string;
  offPeakLocked: boolean;
  offPeakDiscountAmount: number;
  peakUpgradeFeeCharged: number;
  customerRescheduleCount: number;
};

const futureDate = (days = 3) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

async function configure(request: APIRequestContext, adminToken: string, windows: unknown[]) {
  const res = await request.put("/admin/off-peak-hours", {
    headers: authHeader(adminToken),
    data: { timezone: IST, active: true, windows, peakUpgradeFee: FEE },
  });
  expect(res.ok(), `config failed: ${await res.text()}`).toBeTruthy();
}

async function offPeakCode(request: APIRequestContext, adminToken: string, value: number) {
  const code = `RSCH${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const res = await request.post("/admin/discount-codes", {
    headers: authHeader(adminToken),
    data: { code, type: "flat", value, offPeakOnly: true },
  });
  expect(res.status()).toBe(201);
  return code;
}

async function book(
  request: APIRequestContext,
  token: string,
  packageId: string,
  slot: string,
  discountCode?: string,
): Promise<Booking> {
  const res = await request.post("/payments/verify", {
    headers: authHeader(token),
    data: {
      booking: {
        vehicleType: "hatchback",
        vehicleName: "Reschedule Test Car",
        packageId,
        date: futureDate(),
        slot,
        addressLabel: "Home",
        addressLine: "1 Reschedule Street",
        ...(discountCode ? { discountCode } : {}),
      },
    },
  });
  expect(res.status(), `booking failed: ${await res.text()}`).toBe(201);
  return (await res.json()).data as Booking;
}

async function myBooking(request: APIRequestContext, token: string, id: string): Promise<Booking> {
  const rows = (await (await request.get("/bookings", { headers: authHeader(token) })).json())
    .data as Booking[];
  const found = rows.find((b) => b.id === id);
  expect(found, "booking vanished from the customer's list").toBeTruthy();
  return found!;
}

test.describe("Customer reschedule", () => {
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
    await cancelTestBookings(request, adminToken, "Reschedule Test Car");
    await configure(request, adminToken, []);
  });

  test("requires authentication", async ({ request }) => {
    const res = await request.patch("/bookings/000000000000000000000000/reschedule", {
      data: { date: futureDate(), slot: DISCOUNTED_SLOT },
    });
    expect(res.status()).toBe(401);
  });

  test("a customer cannot move someone else's booking", async ({ request }) => {
    const owner = await loginAsNewCustomer(request);
    const stranger = await loginAsNewCustomer(request);
    const booking = await book(request, owner.token, packageId, FULL_PRICE_SLOT);

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(stranger.token),
      data: { date: futureDate(), slot: DISCOUNTED_SLOT },
    });
    expect(res.status()).toBe(404);
  });

  test("an unsubsidised booking moves free, and the slot actually changes", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const booking = await book(request, token, packageId, FULL_PRICE_SLOT);

    const preview = await request.post(`/bookings/${booking.id}/reschedule/preview`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: DISCOUNTED_SLOT },
    });
    expect(preview.ok()).toBeTruthy();
    expect((await preview.json()).data.requiresPayment).toBe(false);

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: DISCOUNTED_SLOT },
    });
    expect(res.ok(), `reschedule failed: ${await res.text()}`).toBeTruthy();

    const after = await myBooking(request, token, booking.id);
    expect(after.slot).toBe(DISCOUNTED_SLOT);
    expect(after.price).toBe(booking.price);
    expect(after.customerRescheduleCount).toBe(1);
  });

  test("a subsidised booking moves free between off-peak slots", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, adminToken, 150);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);
    expect(booking.offPeakLocked).toBe(true);

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(5), slot: DISCOUNTED_SLOT },
    });
    expect(res.ok()).toBeTruthy();

    const after = await myBooking(request, token, booking.id);
    expect(after.price, "a free move must not change the price").toBe(booking.price);
    expect(after.offPeakLocked, "the booking is still subsidised, so still locked").toBe(true);
  });

  /** The loophole itself. */
  test("moving a subsidised booking into a peak slot is refused without a payment choice", async ({
    request,
  }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, adminToken, 150);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("250"); // 150 reclaim + 100 fee

    // And crucially: the slot did NOT move.
    const after = await myBooking(request, token, booking.id);
    expect(after.slot, "a refused upgrade must leave the booking where it was").toBe(DISCOUNTED_SLOT);
    expect(after.price).toBe(booking.price);
  });

  test("paying by cash moves the booking and bills base price plus the fee", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, adminToken, 150);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);
    const basePrice = booking.price + 150;

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT, paymentMethod: "cash" },
    });
    expect(res.ok(), `paid reschedule failed: ${await res.text()}`).toBeTruthy();

    const after = await myBooking(request, token, booking.id);
    expect(after.slot).toBe(FULL_PRICE_SLOT);
    // Service value returns to base; the fee is tracked separately so it never
    // reaches the cleaner's payout base.
    expect(after.price).toBe(basePrice);
    expect(after.peakUpgradeFeeCharged).toBe(FEE);
    // Subsidy repaid, so the booking is no longer tied to off-peak.
    expect(after.offPeakLocked).toBe(false);
    expect(after.offPeakDiscountAmount).toBe(0);
  });

  test("the ledger row follows the new amount owed", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, adminToken, 150);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);

    await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT, paymentMethod: "cash" },
    });

    const after = await myBooking(request, token, booking.id);
    const expected = after.price + after.peakUpgradeFeeCharged;

    let row: { amount: number } | undefined;
    for (let i = 0; i < 20; i++) {
      const rows = (await (await request.get("/admin/payments", { headers: authHeader(adminToken) })).json())
        .data as { bookingId: string | null; amount: number }[];
      row = rows.find((p) => p.bookingId === booking.id);
      if (row?.amount === expected) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(row?.amount, "the cleaner must collect the new total, fee included").toBe(expected);
  });

  test("paying once does not leave the booking liable a second time", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, adminToken, 150);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);

    await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT, paymentMethod: "cash" },
    });
    const afterFirst = await myBooking(request, token, booking.id);

    // A second move to another peak slot must now be free — the subsidy is gone.
    const second = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(5), slot: FULL_PRICE_SLOT },
    });
    expect(second.ok(), `second move should be free: ${await second.text()}`).toBeTruthy();

    const afterSecond = await myBooking(request, token, booking.id);
    expect(afterSecond.price).toBe(afterFirst.price);
    expect(afterSecond.peakUpgradeFeeCharged, "the fee must not be charged twice").toBe(FEE);
  });

  test("a slot less than an hour away is refused", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const booking = await book(request, token, packageId, FULL_PRICE_SLOT);

    // The guard is about the *instant* the slot begins, so this needs a
    // date+slot pair that is behind us no matter when the suite runs.
    //
    // Two hours ago is not enough: before 07:00 local, "two hours ago" is still
    // today, and today's 08:00 slot is then in the FUTURE — the move is
    // legitimately allowed and this test failed for a run at 06:11. Going back
    // a whole day plus a couple of hours puts the slot a clear ~24h in the past
    // at every hour of the clock.
    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), slot: "08:00 AM" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("at least an hour");
  });

  test("a customer runs out of moves after three", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const booking = await book(request, token, packageId, FULL_PRICE_SLOT);

    for (let i = 1; i <= 3; i++) {
      const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
        headers: authHeader(token),
        data: { date: futureDate(3 + i), slot: DISCOUNTED_SLOT },
      });
      expect(res.ok(), `move ${i} should be allowed`).toBeTruthy();
    }

    const fourth = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(9), slot: DISCOUNTED_SLOT },
    });
    expect(fourth.status()).toBe(400);
    expect((await fourth.json()).message).toContain("call support");
  });

  test("a cancelled booking cannot be moved", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const booking = await book(request, token, packageId, FULL_PRICE_SLOT);
    await request.patch(`/bookings/${booking.id}/cancel`, { headers: authHeader(token) });

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: DISCOUNTED_SLOT },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("upcoming");
  });

  test("an invalid slot is rejected before anything is priced", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const booking = await book(request, token, packageId, FULL_PRICE_SLOT);

    const res = await request.patch(`/bookings/${booking.id}/reschedule`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: "03:00 AM" },
    });
    expect(res.status()).toBe(400);
  });

  test("preview never changes the booking", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, adminToken, 150);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);

    await request.post(`/bookings/${booking.id}/reschedule/preview`, {
      headers: authHeader(token),
      data: { date: futureDate(4), slot: FULL_PRICE_SLOT },
    });

    const after = await myBooking(request, token, booking.id);
    expect(after.slot).toBe(DISCOUNTED_SLOT);
    expect(after.price).toBe(booking.price);
    expect(after.customerRescheduleCount).toBe(0);
  });
});

import { test, expect, type APIRequestContext } from "../fixtures/base";
import { authHeader, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";
import { cancelTestBookings } from "../fixtures/booking-cleanup";
import { mongoEval } from "../fixtures/mongo";

/**
 * The peak-upgrade fee is never refunded.
 *
 * It is a platform charge for the disruption of moving a discounted booking into
 * a busy slot, and it is stored apart from the service price precisely so a
 * refund can tell the two apart. Before this guard existed, `refundPayment`
 * capped refunds at the full collected amount and would happily hand the fee
 * back — the rule lived in the copy and nowhere in the code.
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
  label: "Refund test window",
}));

const futureDate = (days = 3) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

type PaymentRow = {
  id: string;
  bookingId: string | null;
  amount: number;
  status: string;
  refundAmount: number;
};

async function configure(request: APIRequestContext, adminToken: string, windows: unknown[]) {
  const res = await request.put("/admin/off-peak-hours", {
    headers: authHeader(adminToken),
    data: { timezone: IST, active: true, windows, peakUpgradeFee: FEE },
  });
  expect(res.ok()).toBeTruthy();
}

/** A booking discounted off-peak, then upgraded to peak by paying the cleaner. */
async function upgradedBooking(request: APIRequestContext, adminToken: string, packageId: string) {
  const code = `RFND${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await request.post("/admin/discount-codes", {
    headers: authHeader(adminToken),
    data: { code, type: "flat", value: RECLAIM, offPeakOnly: true },
  });

  const { token } = await loginAsNewCustomer(request);
  const created = await request.post("/payments/verify", {
    headers: authHeader(token),
    data: {
      booking: {
        vehicleType: "hatchback",
        vehicleName: "Refund Test Car",
        packageId,
        date: futureDate(),
        slot: DISCOUNTED_SLOT,
        addressLabel: "Home",
        addressLine: "1 Refund Street",
        discountCode: code,
      },
    },
  });
  expect(created.status()).toBe(201);
  const booking = (await created.json()).data as { id: string; price: number };

  const moved = await request.patch(`/bookings/${booking.id}/reschedule`, {
    headers: authHeader(token),
    data: { date: futureDate(4), slot: FULL_PRICE_SLOT, paymentMethod: "cash" },
  });
  expect(moved.ok(), `upgrade failed: ${await moved.text()}`).toBeTruthy();

  return { token, bookingId: booking.id, basePrice: booking.price + RECLAIM };
}

async function ledgerRow(
  request: APIRequestContext,
  adminToken: string,
  bookingId: string,
): Promise<PaymentRow> {
  const rows = (await (await request.get("/admin/payments", { headers: authHeader(adminToken) })).json())
    .data as PaymentRow[];
  const row = rows.find((p) => p.bookingId === bookingId);
  expect(row, "no ledger row for the booking").toBeTruthy();
  return row!;
}

/** Refunds require a "paid" row; the cash flow only reaches that on completion. */
function markCollected(bookingId: string) {
  mongoEval(`
    db.payments.updateOne(
      { booking: ObjectId("${bookingId}"), status: "created" },
      { $set: { status: "paid", paymentId: "cash_refund_test" } }
    );
  `);
}

test.describe("Peak upgrade fee — never refunded", () => {
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
    await cancelTestBookings(request, adminToken, "Refund Test Car");
    await configure(request, adminToken, []);
  });

  test("a full refund returns the service price but withholds the fee", async ({ request }) => {
    const { bookingId, basePrice } = await upgradedBooking(request, adminToken, packageId);
    markCollected(bookingId);

    const row = await ledgerRow(request, adminToken, bookingId);
    expect(row.amount, "collected amount is service + fee").toBe(basePrice + FEE);

    // No explicit amount → refund everything that is refundable.
    const res = await request.patch(`/admin/payments/${row.id}/refund`, {
      headers: authHeader(adminToken),
      data: { reason: "customer cancelled" },
    });
    expect(res.ok(), `refund failed: ${await res.text()}`).toBeTruthy();

    const refunded = (await res.json()).data as PaymentRow;
    expect(refunded.refundAmount, "the change fee stays with the platform").toBe(basePrice);
  });

  test("asking for the full collected amount is refused, and says why", async ({ request }) => {
    const { bookingId, basePrice } = await upgradedBooking(request, adminToken, packageId);
    markCollected(bookingId);
    const row = await ledgerRow(request, adminToken, bookingId);

    const res = await request.patch(`/admin/payments/${row.id}/refund`, {
      headers: authHeader(adminToken),
      data: { amount: basePrice + FEE },
    });
    expect(res.status()).toBe(400);
    const message = (await res.json()).message;
    expect(message).toContain(String(FEE));
    expect(message).toContain("not refundable");

    // And nothing was refunded on a rejected attempt.
    const after = await ledgerRow(request, adminToken, bookingId);
    expect(after.status).toBe("paid");
    expect(after.refundAmount).toBe(0);
  });

  test("a partial refund up to the service price is still allowed", async ({ request }) => {
    const { bookingId, basePrice } = await upgradedBooking(request, adminToken, packageId);
    markCollected(bookingId);
    const row = await ledgerRow(request, adminToken, bookingId);

    const res = await request.patch(`/admin/payments/${row.id}/refund`, {
      headers: authHeader(adminToken),
      data: { amount: basePrice },
    });
    expect(res.ok(), `partial refund failed: ${await res.text()}`).toBeTruthy();
    expect((await res.json()).data.refundAmount).toBe(basePrice);
  });

  test("a booking that was never upgraded refunds in full, as before", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const created = await request.post("/payments/verify", {
      headers: authHeader(token),
      data: {
        booking: {
          vehicleType: "hatchback",
          vehicleName: "Refund Test Car",
          packageId,
          date: futureDate(),
          slot: FULL_PRICE_SLOT,
          addressLabel: "Home",
          addressLine: "1 Refund Street",
        },
      },
    });
    const booking = (await created.json()).data as { id: string; price: number };
    markCollected(booking.id);

    const row = await ledgerRow(request, adminToken, booking.id);
    const res = await request.patch(`/admin/payments/${row.id}/refund`, {
      headers: authHeader(adminToken),
      data: {},
    });
    expect(res.ok()).toBeTruthy();
    expect(
      (await res.json()).data.refundAmount,
      "no fee was charged, so the whole payment is refundable",
    ).toBe(booking.price);
  });
});

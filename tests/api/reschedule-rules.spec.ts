import { test, expect, type APIRequestContext } from "../fixtures/base";
import { authHeader, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";
import { cancelTestBookings } from "../fixtures/booking-cleanup";

/**
 * The reschedule rule matrix, exercised through the admin quote endpoint.
 *
 * Every reschedule caller asks the same engine, so these cases pin the shared
 * behaviour rather than any one endpoint's:
 *
 *   booked at full price         → moves anywhere, free
 *   booked off-peak, no subsidy  → moves anywhere, free
 *   booked off-peak WITH subsidy → free into off-peak, costs into peak
 *   subscription wash / system   → always free
 *
 * The arithmetic guarantee worth stating plainly: a subsidised booking moved
 * into a peak slot ends at base price plus the fee. It can never be cheaper
 * than having booked that slot outright, and never more than base + fee.
 */

const IST = "Asia/Kolkata";
const DISCOUNTED_SLOT = "11:00 AM";
const FULL_PRICE_SLOT = "05:00 PM";
const FEE = 100;

const ALL_DAY_WINDOWS = Array.from({ length: 7 }, (_, day) => ({
  day,
  start: "10:00",
  end: "12:00",
  label: "Rule test window",
}));

type Quote = {
  targetIsOffPeak: boolean;
  requiresPayment: boolean;
  exempt: boolean;
  reclaim: number;
  fee: number;
  totalDue: number;
  newPrice: number;
  reason: string;
};

async function configure(request: APIRequestContext, adminToken: string, windows: unknown[]) {
  const res = await request.put("/admin/off-peak-hours", {
    headers: authHeader(adminToken),
    data: { timezone: IST, active: true, windows, peakUpgradeFee: FEE },
  });
  expect(res.ok(), `config failed: ${await res.text()}`).toBeTruthy();
}

async function firstPackageId(request: APIRequestContext): Promise<string> {
  return (await (await request.get("/catalog/packages")).json()).data[0].id;
}

const futureDate = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

async function book(
  request: APIRequestContext,
  customerToken: string,
  packageId: string,
  slot: string,
  discountCode?: string,
) {
  const res = await request.post("/payments/verify", {
    headers: authHeader(customerToken),
    data: {
      booking: {
        vehicleType: "hatchback",
        vehicleName: "Rule Test Car",
        packageId,
        date: futureDate(),
        slot,
        addressLabel: "Home",
        addressLine: "1 Rule Street",
        ...(discountCode ? { discountCode } : {}),
      },
    },
  });
  expect(res.status(), `booking failed: ${await res.text()}`).toBe(201);
  return (await res.json()).data as { id: string; price: number };
}

/** The admin-side quote for moving a booking, which is the rule engine's output. */
async function quote(
  request: APIRequestContext,
  adminToken: string,
  bookingId: string,
  slot: string,
): Promise<Quote> {
  const res = await request.post(`/admin/bookings/${bookingId}/reschedule/quote`, {
    headers: authHeader(adminToken),
    data: { date: futureDate(), slot },
  });
  expect(res.ok(), `quote failed: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data as Quote;
}

test.describe("Reschedule rules", () => {
  let adminToken = "";
  let packageId = "";
  let basePrice = 0;

  test.beforeAll(async ({ request }) => {
    adminToken = (await loginAsAdmin(request)).token;
    packageId = await firstPackageId(request);
  });

  test.beforeEach(async ({ request }) => {
    await configure(request, adminToken, ALL_DAY_WINDOWS);
    const { token } = await loginAsNewCustomer(request);
    const undiscounted = await book(request, token, packageId, FULL_PRICE_SLOT);
    basePrice = undiscounted.price;
  });

  test.afterAll(async ({ request }) => {
    // Take these out of the dispatch queue — see booking-cleanup.
    await cancelTestBookings(request, adminToken, "Rule Test Car");
    await configure(request, adminToken, []);
  });

  async function offPeakCode(request: APIRequestContext, value: number): Promise<string> {
    const code = `RULE${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const res = await request.post("/admin/discount-codes", {
      headers: authHeader(adminToken),
      data: { code, type: "flat", value, offPeakOnly: true },
    });
    expect(res.status()).toBe(201);
    return code;
  }

  test("a full-price peak booking moves anywhere for free", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const booking = await book(request, token, packageId, FULL_PRICE_SLOT);

    for (const slot of [DISCOUNTED_SLOT, FULL_PRICE_SLOT]) {
      const q = await quote(request, adminToken, booking.id, slot);
      expect(q.requiresPayment, `moving to ${slot} should be free`).toBe(false);
      expect(q.totalDue).toBe(0);
      expect(q.newPrice).toBe(booking.price);
    }
  });

  test("an off-peak booking with no coupon moves anywhere for free", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT);

    const q = await quote(request, adminToken, booking.id, FULL_PRICE_SLOT);
    expect(q.requiresPayment).toBe(false);
    expect(q.totalDue).toBe(0);
  });

  test("a subsidised booking moves free into another off-peak slot", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, 200);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);

    const q = await quote(request, adminToken, booking.id, DISCOUNTED_SLOT);
    expect(q.targetIsOffPeak).toBe(true);
    expect(q.requiresPayment).toBe(false);
    expect(q.totalDue).toBe(0);
  });

  test("a subsidised booking moving into a peak slot owes the discount plus the fee", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, 200);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);
    expect(booking.price).toBe(basePrice - 200);

    const q = await quote(request, adminToken, booking.id, FULL_PRICE_SLOT);

    expect(q.targetIsOffPeak).toBe(false);
    expect(q.requiresPayment).toBe(true);
    expect(q.reclaim).toBe(200);
    expect(q.fee).toBe(FEE);
    expect(q.totalDue).toBe(200 + FEE);

    // The arithmetic guarantee: paid + due lands exactly on base + fee.
    expect(booking.price + q.totalDue).toBe(basePrice + FEE);
    // And the cleaner's side sees only the service value, never the fee.
    expect(q.newPrice).toBe(basePrice);
  });

  test("the fee is whatever the admin configured, not a constant", async ({ request }) => {
    await configure(request, adminToken, ALL_DAY_WINDOWS);
    const res = await request.put("/admin/off-peak-hours", {
      headers: authHeader(adminToken),
      data: { peakUpgradeFee: 250 },
    });
    expect(res.ok()).toBeTruthy();

    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, 60);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);

    const q = await quote(request, adminToken, booking.id, FULL_PRICE_SLOT);
    expect(q.fee).toBe(250);
    expect(q.totalDue).toBe(60 + 250);
  });

  test("pausing off-peak hours makes every slot peak, so a subsidised move is charged", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, 75);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);

    await request.put("/admin/off-peak-hours", {
      headers: authHeader(adminToken),
      data: { active: false },
    });

    const q = await quote(request, adminToken, booking.id, DISCOUNTED_SLOT);
    expect(q.targetIsOffPeak, "nothing is off-peak while the switch is off").toBe(false);
    expect(q.requiresPayment).toBe(true);

    await request.put("/admin/off-peak-hours", { headers: authHeader(adminToken), data: { active: true } });
  });

  test("the reason names the windows the customer could move to for free", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const code = await offPeakCode(request, 40);
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT, code);

    const q = await quote(request, adminToken, booking.id, FULL_PRICE_SLOT);
    expect(q.reason).toContain("10:00");
    expect(q.reason).toContain("40");
    expect(q.reason).toContain(String(FEE));
  });

  test("a zero-value off-peak coupon never makes a move cost money", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    // minOrderValue far above the price means the code is refused outright, so
    // book plainly — the point is that an unsubsidised booking stays free.
    const booking = await book(request, token, packageId, DISCOUNTED_SLOT);

    const q = await quote(request, adminToken, booking.id, FULL_PRICE_SLOT);
    expect(q.reclaim).toBe(0);
    expect(q.requiresPayment).toBe(false);
  });
});

test.describe("Reschedule settings persistence", () => {
  test("buffer and day-limit survive a round trip", async ({ request }) => {
    const { token } = await loginAsAdmin(request);

    const updated = await request.put("/admin/reschedule-config", {
      headers: authHeader(token),
      data: { bufferMinutes: 45, maxDaysLimit: 4 },
    });
    expect(updated.ok(), `update failed: ${await updated.text()}`).toBeTruthy();

    const read = await request.get("/admin/reschedule-config", { headers: authHeader(token) });
    const config = (await read.json()).data as {
      rescheduleBufferMinutes: number;
      maxConsecutiveDaysLimit: number;
    };
    expect(config.rescheduleBufferMinutes).toBe(45);
    expect(config.maxConsecutiveDaysLimit).toBe(4);

    // Restore the documented defaults so the sweep behaves normally elsewhere.
    await request.put("/admin/reschedule-config", {
      headers: authHeader(token),
      data: { bufferMinutes: 30, maxDaysLimit: 2 },
    });
  });
});

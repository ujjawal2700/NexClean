import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import { authHeader, loginAsAdmin, loginAsAgent, loginAsNewCustomer } from "../fixtures/api-client";

/** 1x1 transparent PNG — the smallest thing the upload path accepts. */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * Every confirmed booking must leave a row in the payments ledger.
 *
 * Regression guard. NexClean is pay-to-cleaner, so the app confirms a booking
 * straight through POST /payments/verify and never calls /payments/order. That
 * branch used to create the Booking and nothing else — no Payment document at
 * all — so Admin → Payments & Settlement listed only the historical rows from
 * back when Razorpay orders were being created, and every new booking was
 * invisible there. Revenue, pending settlement and the refund/settle actions
 * all hang off these rows, so the gap silently broke the whole money screen.
 */

type PaymentRow = {
  id: string;
  bookingId: string | null;
  orderId: string;
  amount: number;
  status: string;
  settlementStatus: string;
};

async function adminPayments(request: APIRequestContext, adminToken: string): Promise<PaymentRow[]> {
  const res = await request.get("/admin/payments", { headers: authHeader(adminToken) });
  expect(res.ok(), `admin payments fetch failed: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data as PaymentRow[];
}

async function firstPackageId(request: APIRequestContext): Promise<string> {
  return (await (await request.get("/catalog/packages")).json()).data[0].id;
}

/** Confirms a booking exactly the way the customer app does: verify, no order id. */
async function confirmBookingLikeTheApp(
  request: APIRequestContext,
  customerToken: string,
  packageId: string,
): Promise<{ bookingId: string; price: number }> {
  const res = await request.post("/payments/verify", {
    headers: authHeader(customerToken),
    data: {
      booking: {
        vehicleType: "hatchback",
        vehicleName: "Ledger Test Car",
        packageId,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        slot: "11:00 AM",
        addressLabel: "Home",
        addressLine: "123 Ledger Street",
      },
    },
  });
  expect(res.status(), `verify failed: ${await res.text()}`).toBe(201);
  const booking = (await res.json()).data;
  return { bookingId: booking.id, price: booking.price };
}

/** Walks a job to completed, satisfying the before/after photo gate. */
async function completeJob(request: APIRequestContext, agentToken: string, bookingId: string) {
  // Completing a job now requires four real photos per side — an image-less
  // POST no longer flips hasBefore/hasAfter, because that flag is derived from
  // the stored array. Four tiny PNGs is the cheapest way to satisfy it.
  for (const kind of ["before", "after"] as const) {
    for (let i = 0; i < 4; i++) {
      await request.post(`/agent/jobs/${bookingId}/photo`, {
        headers: authHeader(agentToken),
        data: { kind, image: TINY_PNG },
      });
    }
  }
  for (let i = 0; i < 6; i++) {
    const res = await request.patch(`/agent/jobs/${bookingId}/advance`, { headers: authHeader(agentToken) });
    const body = await res.json();
    if (body.data?.status === "completed") return;
  }
  throw new Error("job never reached completed");
}

test.describe("Payments ledger", () => {
  test("a booking confirmed through the app appears in the admin payments list", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);

    const before = await adminPayments(request, adminToken);
    const { bookingId, price } = await confirmBookingLikeTheApp(request, customerToken, packageId);
    const after = await adminPayments(request, adminToken);

    expect(after.length).toBe(before.length + 1);

    const row = after.find((p) => p.bookingId === bookingId);
    expect(row, "the confirmed booking has no row in the payments ledger").toBeTruthy();
    // Cash is owed but not yet collected — it is handed over on completion.
    expect(row!.status).toBe("created");
    expect(row!.amount).toBe(price);
    expect(row!.orderId.startsWith("cash_")).toBe(true);
  });

  test("the newest booking sorts to the top of the list", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);

    const { bookingId } = await confirmBookingLikeTheApp(request, customerToken, packageId);

    const rows = await adminPayments(request, adminToken);
    expect(rows[0]?.bookingId, "newest payment is not first — the list is not newest-first").toBe(bookingId);
  });

  test("completing the job marks the cash as collected, and it can then be settled", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const { token: agentToken, userId: agentId } = await loginAsAgent(request);
    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);

    const { bookingId } = await confirmBookingLikeTheApp(request, customerToken, packageId);

    const assign = await request.patch(`/admin/bookings/${bookingId}/assign`, {
      headers: authHeader(adminToken),
      data: { agentId },
    });
    expect(assign.ok(), `assign failed: ${await assign.text()}`).toBeTruthy();

    await completeJob(request, agentToken, bookingId);

    // The mark-as-collected write is fire-and-forget so it can never block a
    // cleaner from closing a job — poll briefly rather than assuming it landed
    // before the completion response came back.
    let row: PaymentRow | undefined;
    for (let i = 0; i < 20; i++) {
      row = (await adminPayments(request, adminToken)).find((p) => p.bookingId === bookingId);
      if (row?.status === "paid") break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(row?.status, "completing the job did not mark the payment collected").toBe("paid");

    // "paid" is exactly what unlocks settlement, which was impossible before.
    const settle = await request.patch(`/admin/payments/${row!.id}/settle`, { headers: authHeader(adminToken) });
    expect(settle.ok(), `settle failed: ${await settle.text()}`).toBeTruthy();
    expect((await settle.json()).data.settlementStatus).toBe("settled");
  });

  test("collected cash is counted in the admin payment stats", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const { token: agentToken, userId: agentId } = await loginAsAgent(request);
    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);

    const statsBefore = (await (await request.get("/admin/payments/stats", { headers: authHeader(adminToken) })).json()).data;

    const { bookingId, price } = await confirmBookingLikeTheApp(request, customerToken, packageId);
    await request.patch(`/admin/bookings/${bookingId}/assign`, {
      headers: authHeader(adminToken),
      data: { agentId },
    });
    await completeJob(request, agentToken, bookingId);

    let statsAfter = statsBefore;
    for (let i = 0; i < 20; i++) {
      statsAfter = (await (await request.get("/admin/payments/stats", { headers: authHeader(adminToken) })).json()).data;
      if (statsAfter.totalCollected >= statsBefore.totalCollected + price) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(statsAfter.totalCollected).toBe(statsBefore.totalCollected + price);
  });

  test("an unfinished booking is not counted as collected revenue", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);

    const statsBefore = (await (await request.get("/admin/payments/stats", { headers: authHeader(adminToken) })).json()).data;
    await confirmBookingLikeTheApp(request, customerToken, packageId);
    const statsAfter = (await (await request.get("/admin/payments/stats", { headers: authHeader(adminToken) })).json()).data;

    // Booking the job does not mean the cash has changed hands.
    expect(statsAfter.totalCollected).toBe(statsBefore.totalCollected);
  });

  test("settling is still refused while the cash has not been collected", async ({ request }) => {
    const { token: adminToken } = await loginAsAdmin(request);
    const { token: customerToken } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);

    const { bookingId } = await confirmBookingLikeTheApp(request, customerToken, packageId);
    const row = (await adminPayments(request, adminToken)).find((p) => p.bookingId === bookingId);

    const settle = await request.patch(`/admin/payments/${row!.id}/settle`, { headers: authHeader(adminToken) });
    expect(settle.status()).toBe(400);
    expect((await settle.json()).message).toContain("Only paid payments can be settled");
  });
});

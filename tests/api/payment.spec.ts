import { test, expect } from "../fixtures/base";
import type { APIRequestContext } from "@playwright/test";
import { authHeader, loginAsNewCustomer } from "../fixtures/api-client";

async function firstPackageId(request: APIRequestContext): Promise<string> {
  const body = await (await request.get("/catalog/packages")).json();
  return body.data[0].id;
}

function bookingDraft(packageId: string) {
  return {
    vehicleType: "hatchback",
    vehicleName: "Test Car",
    packageId,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    slot: "11:00 AM",
    addressLabel: "Home",
    addressLine: "123 Test Street",
  };
}

test.describe("Payment (mock mode — no Razorpay keys in this environment)", () => {
  test("preview computes a price without creating anything", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const res = await request.post("/payments/preview", {
      headers: authHeader(token),
      data: { vehicleType: "hatchback", packageId },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.price).toBeGreaterThan(0);
  });

  test("preview rejects an unknown package", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.post("/payments/preview", {
      headers: authHeader(token),
      data: { vehicleType: "hatchback", packageId: "does-not-exist" },
    });
    expect(res.status()).toBe(400);
  });

  test("order → verify creates a real booking (mock mode skips signature check)", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const booking = bookingDraft(packageId);

    const order = await request.post("/payments/order", { headers: authHeader(token), data: { booking } });
    expect(order.ok()).toBeTruthy();
    const orderBody = await order.json();
    expect(orderBody.data.mock).toBe(true);
    expect(orderBody.data.orderId).toBeTruthy();

    const verify = await request.post("/payments/verify", {
      headers: authHeader(token),
      data: { booking, razorpay_order_id: orderBody.data.orderId },
    });
    expect(verify.ok()).toBeTruthy();
    const verifyBody = await verify.json();
    expect(verifyBody.data.id).toBeTruthy();
    expect(verifyBody.data.status).toBe("upcoming");
  });

  test("rejects checkout when the displayed price is stale", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const packageId = await firstPackageId(request);
    const booking = bookingDraft(packageId);
    const preview = await request.post("/payments/preview", {
      headers: authHeader(token),
      data: { vehicleType: booking.vehicleType, packageId },
    });
    const quoted = (await preview.json()).data.price as number;

    const order = await request.post("/payments/order", {
      headers: authHeader(token),
      data: { booking, expectedAmount: quoted - 10 },
    });
    expect(order.status()).toBe(409);
    const body = await order.json();
    expect(body.message).toContain("price has been updated");
    expect(body.details).toMatchObject({ code: "PRICE_CHANGED", currentAmount: quoted });
  });

  test("order requires auth", async ({ request }) => {
    const packageId = await firstPackageId(request);
    const res = await request.post("/payments/order", { data: { booking: bookingDraft(packageId) } });
    expect(res.status()).toBe(401);
  });
});

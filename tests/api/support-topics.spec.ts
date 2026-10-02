import { test, expect } from "../fixtures/base";
import { authHeader, loginAsNewCustomer, loginAsAdmin, apiUrl } from "../fixtures/api-client";

async function createBooking(request: import("@playwright/test").APIRequestContext, token: string) {
  const res = await request.post(apiUrl("/bookings"), {
    headers: authHeader(token),
    data: {
      vehicleType: "hatchback",
      vehicleName: "Topic Car",
      packageId: "express",
      date: new Date(Date.now() + 2 * 864e5).toISOString(),
      slot: "11:00 AM",
      addressLabel: "Home",
      addressLine: "1 Topic Road",
    },
  });
  return (await res.json()).data.id as string;
}

test.describe("Support conversations by topic and booking", () => {
  test("a booking conversation is linked to the booking and reused, not duplicated", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const bookingId = await createBooking(request, token);

    const first = await request.post(apiUrl("/chat/tickets"), {
      headers: authHeader(token),
      data: { topic: "booking", bookingId },
    });
    expect(first.ok()).toBeTruthy();
    const t1 = (await first.json()).data;
    expect(t1.topic).toBe("booking");
    expect(t1.booking.id ?? t1.booking._id ?? t1.booking).toBeTruthy();
    expect(t1.subject).toContain("Topic Car");

    const again = (await (await request.post(apiUrl("/chat/tickets"), { headers: authHeader(token), data: { topic: "booking", bookingId } })).json()).data;
    expect(again.id).toBe(t1.id);

    // A different topic is its own conversation.
    const payment = (await (await request.post(apiUrl("/chat/tickets"), { headers: authHeader(token), data: { topic: "payment" } })).json()).data;
    expect(payment.id).not.toBe(t1.id);
    expect(payment.subject).toBe("Payments & refunds");
  });

  test("can't open a conversation about someone else's booking", async ({ request }) => {
    const { token: owner } = await loginAsNewCustomer(request);
    const bookingId = await createBooking(request, owner);
    const { token: stranger } = await loginAsNewCustomer(request);
    const res = await request.post(apiUrl("/chat/tickets"), {
      headers: authHeader(stranger),
      data: { topic: "booking", bookingId },
    });
    expect(res.status()).toBe(404);
  });

  test("the admin 'waiting on support' count follows who spoke last", async ({ request }) => {
    const { token: admin } = await loginAsAdmin(request);
    const count = async () => (await (await request.get(apiUrl("/admin/attention"), { headers: authHeader(admin) })).json()).data;

    const before = await count();
    expect(typeof before.payoutRequests).toBe("number");
    expect(typeof before.refunds).toBe("number");

    const { token } = await loginAsNewCustomer(request);
    const ticket = (await (await request.post(apiUrl("/chat/tickets"), { headers: authHeader(token), data: { topic: "app" } })).json()).data;
    await request.post(apiUrl(`/chat/tickets/${ticket.id}/messages`), { headers: authHeader(token), data: { text: "App crashes" } });
    expect((await count()).supportChats).toBe(before.supportChats + 1);

    await request.post(apiUrl(`/chat/tickets/${ticket.id}/messages`), { headers: authHeader(admin), data: { text: "Looking into it" } });
    expect((await count()).supportChats).toBe(before.supportChats);
  });
});

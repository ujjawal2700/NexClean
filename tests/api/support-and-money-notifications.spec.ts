import { test, expect } from "../fixtures/base";
import { authHeader, loginAsNewCustomer, loginAsAdmin, loginAsAgent, apiUrl } from "../fixtures/api-client";
import { goOnlineNear, completeAnyOpenJobsForAgent } from "../fixtures/agent-e2e-helpers";

const notes = async (request: import("@playwright/test").APIRequestContext, token: string) =>
  (await (await request.get(apiUrl("/notifications"), { headers: authHeader(token) })).json()).data as Array<{
    title: string;
    body: string;
    data?: Record<string, string>;
  }>;

test.describe("Notifications that link somewhere useful", () => {
  test("a support reply notifies the customer and deep-links to that conversation", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const { token: admin } = await loginAsAdmin(request);
    const ticket = (await (await request.post(apiUrl("/chat/tickets"), { headers: authHeader(token), data: { topic: "payment" } })).json()).data;
    await request.post(apiUrl(`/chat/tickets/${ticket.id}/messages`), { headers: authHeader(token), data: { text: "Where is my refund?" } });
    await request.post(apiUrl(`/chat/tickets/${ticket.id}/messages`), { headers: authHeader(admin), data: { text: "It was sent today." } });

    await expect
      .poll(async () => (await notes(request, token)).find((n) => n.data?.kind === "support")?.data?.url, { timeout: 10_000 })
      .toBe(`/app/help?ticket=${ticket.id}`);
    const n = (await notes(request, token)).find((x) => x.data?.kind === "support")!;
    expect(n.title).toBe("💬 NexClean Support replied");
    expect(n.body).toBe("It was sent today.");
  });

  test("a support reply to a cleaner deep-links into the cleaner app", async ({ request }) => {
    const { token } = await loginAsAgent(request);
    const { token: admin } = await loginAsAdmin(request);
    const ticket = (await (await request.post(apiUrl("/chat/tickets"), { headers: authHeader(token), data: { topic: "app" } })).json()).data;
    await request.post(apiUrl(`/chat/tickets/${ticket.id}/messages`), { headers: authHeader(admin), data: { text: "Try updating the app." } });
    await expect
      .poll(async () => (await notes(request, token)).find((n) => n.data?.ticketId === ticket.id)?.data?.url, { timeout: 10_000 })
      .toBe(`/agent/help?ticket=${ticket.id}`);
  });

  test("a refund made from Payments tells the customer", async ({ request }) => {
    test.setTimeout(90_000);
    const { token } = await loginAsNewCustomer(request);
    const { token: admin } = await loginAsAdmin(request);
    // A cash booking whose cash is collected on completion, so its payment is "paid".
    const booking = (
      await (
        // The app's cash checkout: confirms the booking and opens its cash ledger row.
        await request.post(apiUrl("/payments/verify"), {
          headers: authHeader(token),
          data: {
            booking: {
              vehicleType: "hatchback",
              vehicleName: "Refund Notify Car",
              packageId: "express",
              date: new Date(Date.now() + 2 * 864e5).toISOString(),
              slot: "11:00 AM",
              addressLabel: "Home",
              addressLine: "1 Notify Lane",
            },
          },
        })
      ).json()
    ).data;
    // The cleaner completes the job — that's when cash counts as collected ("paid").
    const { token: agentToken, userId: agentId } = await loginAsAgent(request);
    await completeAnyOpenJobsForAgent(request, agentToken);
    await goOnlineNear(request, agentToken);
    const assigned = await request.patch(apiUrl(`/admin/bookings/${booking.id}/assign`), {
      headers: authHeader(admin),
      data: { agentId },
    });
    expect(assigned.ok(), await assigned.text()).toBeTruthy();
    await completeAnyOpenJobsForAgent(request, agentToken);
    const payments = (await (await request.get(apiUrl("/admin/payments"), { headers: authHeader(admin) })).json()).data as Array<{
      id: string;
      bookingId: string;
      status: string;
    }>;
    const pay = payments.find((p) => p.bookingId === booking.id);
    expect(pay?.status).toBe("paid");

    const refund = await request.patch(apiUrl(`/admin/payments/${pay!.id}/refund`), {
      headers: authHeader(admin),
      data: { amount: 100, reason: "Goodwill" },
    });
    expect(refund.ok()).toBeTruthy();
    await expect
      .poll(async () => (await notes(request, token)).find((n) => n.title === "✅ Refund sent")?.data?.url, { timeout: 10_000 })
      .toBe(`/app/track/${booking.id}`);
    expect((await notes(request, token)).find((n) => n.title === "✅ Refund sent")!.body).toContain("₹100");
  });
});

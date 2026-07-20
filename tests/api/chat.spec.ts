import { test, expect } from "../fixtures/base";
import { authHeader, loginAsNewCustomer } from "../fixtures/api-client";

test.describe("Chat / support", () => {
  test("requires auth", async ({ request }) => {
    const res = await request.get("/chat/tickets");
    expect(res.status()).toBe(401);
  });

  test("support config is readable by an authenticated customer", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.get("/chat/config", { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
  });

  test("a customer cannot change support config (admin-only)", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.patch("/chat/config", { headers: authHeader(token), data: { manualSupportStatus: "online" } });
    expect(res.status()).toBe(403);
  });

  test("creating a ticket then posting a message round-trips", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);

    const ticketRes = await request.post("/chat/tickets", { headers: authHeader(token), data: { subject: "Test issue" } });
    expect(ticketRes.ok()).toBeTruthy();
    const ticket = (await ticketRes.json()).data;
    expect(ticket.id).toBeTruthy();

    const msgRes = await request.post(`/chat/tickets/${ticket.id}/messages`, {
      headers: authHeader(token),
      data: { text: "Hello, I need help" },
    });
    expect(msgRes.ok()).toBeTruthy();

    const listRes = await request.get(`/chat/tickets/${ticket.id}/messages`, { headers: authHeader(token) });
    expect(listRes.ok()).toBeTruthy();
    const messages = (await listRes.json()).data;
    expect(messages.some((m: { text: string }) => m.text === "Hello, I need help")).toBe(true);
  });

  test("an empty message is rejected", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const ticket = (
      await (await request.post("/chat/tickets", { headers: authHeader(token), data: { subject: "Empty msg test" } })).json()
    ).data;
    const res = await request.post(`/chat/tickets/${ticket.id}/messages`, { headers: authHeader(token), data: { text: "   " } });
    expect(res.status()).toBe(400);
  });
});

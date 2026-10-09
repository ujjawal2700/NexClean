import { test, expect } from "../fixtures/base";
import { authHeader, loginAsNewCustomer, loginAsAdmin } from "../fixtures/api-client";
import { WEBP_PHOTO } from "../fixtures/chat-photos";

const image = `data:image/webp;base64,${WEBP_PHOTO}`;

test("support photos round-trip in both directions, and remain scoped to their owner", async ({ request }) => {
  const { token } = await loginAsNewCustomer(request);
  const { token: admin } = await loginAsAdmin(request);
  const { token: stranger } = await loginAsNewCustomer(request);
  const ticket = (await (await request.post("/chat/tickets", { headers: authHeader(token), data: { topic: "payment" } })).json()).data;
  const url = `/chat/tickets/${ticket.id}/messages`;
  for (const sender of [token, admin]) {
    const response = await request.post(url, { headers: authHeader(sender), data: { image } });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).data.imageUrl).toBe(image);
  }
  await expect.poll(async () => {
    const notifications = (await (await request.get("/notifications", { headers: authHeader(token) })).json()).data;
    return notifications.find((n: any) => n.data?.ticketId === ticket.id)?.body;
  }).toBe("Support sent you a photo");
  const history = (await (await request.get(url, { headers: authHeader(token) })).json()).data;
  expect(history.map((m: any) => m.senderType)).toEqual(["customer", "staff"]);
  expect(history.every((m: any) => m.imageUrl === image && m.text === "")).toBe(true);
  expect((await request.post(url, { headers: authHeader(stranger), data: { image } })).status()).toBe(404);
  expect((await request.get(url, { headers: authHeader(stranger) })).status()).toBe(404);
  await request.patch(`/chat/tickets/${ticket.id}/close`, { headers: authHeader(token) });
  expect((await request.post(url, { headers: authHeader(token), data: { image } })).status()).toBe(400);
});

test("chat rejects remote URLs, non-images, invalid payloads, oversized photos and invalid text", async ({ request }) => {
  const { token } = await loginAsNewCustomer(request);
  const ticket = (await (await request.post("/chat/tickets", { headers: authHeader(token), data: {} })).json()).data;
  for (const data of [
    { image: "https://example.com/private" }, { image: "data:image/svg+xml;base64,PHN2Zz4=" },
    { image: "data:image/webp;base64,aGVsbG8=" }, { image: image + "A".repeat(1500000) },
    { text: {} }, { text: "a".repeat(4001) }, { image: 42 },
  ]) {
    const res = await request.post(`/chat/tickets/${ticket.id}/messages`, { headers: authHeader(token), data });
    expect(res.status()).toBe(400);
  }
  const history = (await (await request.get(`/chat/tickets/${ticket.id}/messages`, { headers: authHeader(token) })).json()).data;
  expect(history).toHaveLength(0);
});

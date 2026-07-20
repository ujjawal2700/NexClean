import { test, expect } from "../fixtures/base";
import { authHeader, loginAsNewCustomer } from "../fixtures/api-client";

test.describe("Wallet", () => {
  test("requires auth", async ({ request }) => {
    const res = await request.get("/wallet");
    expect(res.status()).toBe(401);
  });

  test("a fresh customer has a zero balance", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    const res = await request.get("/wallet", { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.coins).toBe(0);
    expect(body.data.transactions).toEqual([]);
  });
});

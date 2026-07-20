import { test, expect } from "../fixtures/base";

test.describe("Health", () => {
  test("GET /health reports ok with a connected db", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("ok");
    expect(body.db).toBe("connected");
  });
});

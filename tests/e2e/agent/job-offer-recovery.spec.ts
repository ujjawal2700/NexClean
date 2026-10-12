import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";

// Isolated browser regressions: no backend or database writes.
const profile = {
  id: "agent-test", role: "agent", name: "Test Cleaner", phone: "9999999999",
  agentStatus: "verified", online: true, area: "Test", rating: 5, jobsDone: 0,
};
const offer = () => ({
  bookingId: "booking-test", customerName: "Customer", vehicleType: "sedan",
  vehicleName: "Test car", packageName: "Exterior wash", addressLabel: "Home",
  addressLine: "Test street", society: "Test society", date: new Date().toISOString(),
  slot: "10:00 AM", price: 200, payout: 150, distanceKm: 1,
  isSubscriptionWash: false, expiresAt: new Date(Date.now() + 60_000).toISOString(),
});

async function setup(page: Page, rejectFirst = false) {
  await page.addInitScript(() => {
    localStorage.setItem("nexclean-agent-session", JSON.stringify({ state: { authenticated: true }, version: 0 }));
    localStorage.setItem("nexclean-cookie-consent", JSON.stringify({ version: 1, necessary: true, functional: false }));
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const data = path === "/api/auth/me" || path === "/api/agent/heartbeat" ? profile
      : path === "/api/agent/offers/current" ? null
      : path === "/api/agent/summary" ? { jobsToday: 0, completedToday: 0, earnedToday: 0, potentialToday: 0 }
      : path === "/api/config/public" ? {} : [];
    await route.fulfill({ json: { success: true, data } });
  });
  let connected: WebSocketRoute | undefined;
  let attempts = 0;
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    ws.send('0{"sid":"test","upgrades":[],"pingInterval":25000,"pingTimeout":20000}');
    ws.onMessage((message) => {
      if (String(message).startsWith("40")) {
        attempts++;
        if (rejectFirst && attempts === 1) {
          ws.send('44{"message":"Authentication error: Could not verify session"}');
        } else {
          connected = ws;
          ws.send('40{"sid":"test-agent"}');
        }
      }
    });
  });
  await page.goto("/agent/jobs");
  await expect(page.getByRole("heading", { name: "Jobs", exact: true })).toBeVisible();
  return {
    emit: async (event: string, payload: unknown) => {
      await expect.poll(() => !!connected).toBeTruthy();
      connected!.send(`42${JSON.stringify([event, payload])}`);
    },
    attempts: () => attempts,
  };
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 480 }, { width: 844, height: 390 }]) {
  test(`socket offer opens the popup at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const socket = await setup(page);
    await socket.emit("job_offer", offer());
    await expect(page.getByText("New wash request", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept job" })).toBeInViewport();
    await expect(page.getByText("Your payout", { exact: true })).toBeVisible();
    await expect(page.getByText("₹150", { exact: true })).toBeVisible();
    const box = (await page.getByRole("button", { name: "Accept job" }).boundingBox())!;
    expect(viewport.height - box.y - box.height).toBeGreaterThanOrEqual(viewport.width < 1024 ? 48 : 12);
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(page.getByText("New wash request", { exact: true })).toHaveCount(0);
  });
}

test("a delayed REST offer cannot reopen a revoked popup", async ({ page }) => {
  const socket = await setup(page);
  const pending = offer();
  let release!: () => void;
  let started = false;
  await page.route("**/api/agent/offers/current", async (route) => {
    started = true;
    await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ json: { success: true, data: pending } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => started).toBeTruthy();
  await socket.emit("job_offer", pending);
  await expect(page.getByText("New wash request", { exact: true })).toBeVisible();
  await socket.emit("offer_revoked", { bookingId: pending.bookingId });
  await expect(page.getByText("New wash request", { exact: true })).toHaveCount(0);
  const response = page.waitForResponse("**/api/agent/offers/current");
  release();
  await response;
  // A rendering roundtrip lets the reconciliation promise settle.
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.getByText("New wash request", { exact: true })).toHaveCount(0);
});

test("retries a socket rejected by transient authentication failure", async ({ page }) => {
  const socket = await setup(page, true);
  await expect.poll(socket.attempts, { timeout: 10_000 }).toBeGreaterThan(1);
  await socket.emit("job_offer", offer());
  await expect(page.getByText("New wash request", { exact: true })).toBeVisible();
});

test("REST polling recovers a job when no offer event arrives", async ({ page }) => {
  await setup(page);
  const pending = offer();
  await page.route("**/api/agent/offers/current", (route) => route.fulfill({ json: { success: true, data: pending } }));
  await expect(page.getByText("New wash request", { exact: true })).toBeVisible({ timeout: 10_000 });
});

test("expiry closes the popup even when reconciliation fails", async ({ page }) => {
  const socket = await setup(page);
  await page.route("**/api/agent/offers/current", (route) => route.abort());
  await socket.emit("job_offer", { ...offer(), expiresAt: new Date(Date.now() + 2_000).toISOString() });
  await expect(page.getByText("New wash request", { exact: true })).toBeVisible();
  await expect(page.getByText("New wash request", { exact: true })).toHaveCount(0, { timeout: 5_000 });
});

test("REST responses slower than the polling interval still restore the popup", async ({ page }) => {
  await setup(page);
  const pending = offer();
  let requests = 0;
  await page.route("**/api/agent/offers/current", async (route) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    await route.fulfill({ json: { success: true, data: pending } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("New wash request", { exact: true })).toBeVisible({ timeout: 12_000 });
  expect(requests).toBe(1);
});

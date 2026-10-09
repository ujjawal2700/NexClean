import { test, expect } from "@playwright/test";

const job = {
  id: "layout-job", customerName: "Ujjawal Mahawar", vehicleType: "hatchback", vehicleName: "Hyundai i10",
  packageName: "Premium Detail", date: "2026-10-10", slot: "11:45 PM", addressLabel: "Office",
  addressLine: "Corporate House, 5th floor, Near Nexus Mall, Indore, PIN 452001", society: "Corporate House",
  payout: 336, price: 480, distanceKm: 0.8, status: "completed", hasBefore: true, hasAfter: true,
  beforePhotos: [], afterPhotos: [],
};
const plans = [
  { id: "premium", name: "Premium", price: 555, prices: { hatchback: 555 }, washesPerMonth: 8, keyPoints: [], featured: true },
  { id: "elite", name: "Elite", price: 999, prices: { hatchback: 999 }, washesPerMonth: -1, keyPoints: [], featured: false },
  { id: "basic", name: "Basic", price: 299, prices: { hatchback: 299 }, washesPerMonth: 4, keyPoints: [], featured: false },
];
for (const width of [320, 375, 768, 1280]) {
  for (const [route, heading] of [
    ["/app/plans", "Subscription plans"], ["/agent/jobs", "Jobs"],
    ["/agent/jobs/layout-job", "Hyundai i10"], ["/agent/profile", "Profile"], ["/agent/earnings", "Earnings"],
  ]) {
    test(`${route} stays readable without overflow at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 899 });
      await page.addInitScript(() => {
        for (const key of ["nexclean-session", "nexclean-agent-session"]) {
          localStorage.setItem(key, JSON.stringify({ state: { authenticated: true, guest: false }, version: 0 }));
        }
        localStorage.setItem("nexclean-cookie-consent", JSON.stringify({ version: 1, necessary: true, functional: false }));
      });
      await page.route("**/api/**", async (r) => {
        const pathname = new URL(r.request().url()).pathname;
        if (!pathname.startsWith("/api/")) return r.continue();
        const path = pathname.replace(/^\/api/, "");
        const profile = { id: "layout-agent", name: "Palak Patel", phone: "9999999999", role: route.startsWith("/agent") ? "agent" : "customer",
          email: "palak.patel.with.a.long.email@example.com", agentStatus: "verified", rating: 5, ratingCount: 1,
          jobsDone: 1, online: false, vehicles: [], addresses: [], activePlan: null };
        const data = path === "/auth/me" || path === "/agent/heartbeat" ? profile
          : path === "/agent/jobs" ? [job, { ...job, id: "cancelled-job", vehicleName: "Audi S3", status: "cancelled", payout: 0 }]
          : path === "/agent/summary" ? { jobsToday: 0, completedToday: 0, earnedToday: 0, potentialToday: 0 }
          : path === "/agent/offers/current" ? null
          : path === "/catalog/plans" ? plans
          : path === "/wallet" ? { coins: 0 }
          : path === "/subscriptions/schedule" ? { bookings: [] }
          : path === "/config/public" ? {} : [];
        await r.fulfill({ json: { success: true, data } });
      });
      await page.routeWebSocket(/\/socket\.io\//, (ws) => {
        ws.send('0{"sid":"layout","upgrades":[],"pingInterval":25000,"pingTimeout":20000}');
        ws.onMessage((m) => { if (String(m).startsWith("40")) ws.send('40{"sid":"layout-agent"}'); });
      });
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      if (route === "/agent/jobs") await page.getByRole("button", { name: "All", exact: true }).click();
      if (route === "/app/plans") await expect(page.getByRole("button", { name: "Choose Premium", exact: true })).toBeVisible();
      if (route === "/agent/earnings") await expect(page.getByText("₹336", { exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("layout.png"), fullPage: true, animations: "disabled" });
    });
  }
}

test("customer login handles an agent device-switch response without a raw error", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("nexclean-cookie-consent", JSON.stringify({ version: 1, necessary: true, functional: false })));
  await page.route("**/api/auth/send-login-otp", (r) => r.fulfill({ json: { success: true, data: { sent: true } } }));
  await page.route("**/api/auth/verify-otp", (r) => r.fulfill({ json: { success: true, data: { deviceSwitchRequired: true, switchTicket: "test-switch" } } }));
  await page.goto("/app/login");
  await page.getByRole("textbox", { name: "Mobile number" }).fill("9999999999");
  await page.getByRole("button", { name: "Send OTP" }).click();
  await page.getByRole("textbox", { name: "One-time code" }).fill("123456");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await expect(page.getByText(/Please use Agent Login/)).toBeVisible();
  await expect(page.getByText(/TypeError/)).toHaveCount(0);
  await expect(page).toHaveURL(/\/app\/login$/);
});

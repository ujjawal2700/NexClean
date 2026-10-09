import { test, expect } from "@playwright/test";

const job = {
  id: "layout-job", customerName: "Ujjawal Mahawar", vehicleType: "hatchback", vehicleName: "Hyundai i10",
  packageName: "Premium Detail", date: "2026-10-10", slot: "11:45 PM", addressLabel: "Office",
  addressLine: "Corporate House, 5th floor, Near Nexus Mall, Indore, PIN 452001", society: "Corporate House",
  payout: 336, price: 480, distanceKm: 0.8, status: "completed", hasBefore: true, hasAfter: true,
  beforePhotos: [], afterPhotos: [],
};
const plans = [
  { id: "premium", name: "Premium", price: 555, prices: { hatchback: 555 }, washesPerMonth: 8, keyPoints: [], featured: true, active: true },
  { id: "elite", name: "Elite", price: 999, prices: { hatchback: 999 }, washesPerMonth: -1, keyPoints: [], featured: false, active: true },
  { id: "basic", name: "Basic", price: 299, prices: { hatchback: 299 }, washesPerMonth: 4, keyPoints: [], featured: false, active: true },
];
for (const width of [320, 375, 1280]) {
  for (const [route, heading] of [
    ["/agent", "Palak Patel 👋"], ["/agent/profile/edit", "Edit Profile"],
    ["/app/profile/edit", "Edit Profile"], ["/app", "Palak 👋"],
    ["/app/book", "Book a cleaning"], ["/app/bookings", "My bookings"],
    ["/app/bookings/layout-job", "Booking details"], ["/app/bookings/layout-job/invoice", "Invoice"],
    ["/app/profile/vehicles", "Your garage"], ["/app/profile/addresses", "Saved addresses"],
    ["/app/profile/refer", "Refer & Earn"],
    ["/agent/help?ticket=layout-ticket", "chat"], ["/app/help?ticket=layout-ticket", "chat"],
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
          jobsDone: 1, online: false, vehicles: [{ id: "car", name: "Hyundai i20", type: "hatchback", plate: "MP 09 AB 1234" }], addresses: [{ id: "address", label: "Office", line: job.addressLine, coordinates: [75.87, 22.71] }], activePlan: null };
        const booking = { ...job, status: "cancelled", total: 472, agent: null, agentName: null };
        const invoice = { invoice: { id: "invoice", invoiceNumber: "NXC/2026-27/00050", issuedAt: "2026-10-09", status: "cancelled", seller: { tradeName: "NexClean", email: "billing.with.a.very.long.address@nexclean.example.com" }, billTo: { name: "Palak Patel", address: job.addressLine }, service: { packageName: job.packageName, date: job.date, slot: job.slot, vehicleName: job.vehicleName, address: job.addressLine }, lines: [{ kind: "service", description: "Premium Detail – Hyundai i20 doorstep wash", sac: "998729", amount: 400 }], subtotal: 400, discountTotal: 0, taxableAmount: 400, taxAmount: 72, taxRate: 18, cgstAmount: 36, sgstAmount: 36, roundOff: 0, total: 472, amountPaid: 0 }, template: { title: "Tax Invoice", showLogo: true, showVehicleDetails: true, showServiceAddress: true, showTaxBreakup: true, showAmountInWords: true, showPaymentInfo: true, terms: "Computer generated invoice.", labels: { billTo: "Bill to", serviceDetails: "Service details", description: "Description", amount: "Amount", subtotal: "Subtotal", taxable: "Taxable value", total: "Total" } } };
        const data = path === "/bookings/layout-job/invoice" ? invoice
          : path === "/bookings/layout-job" ? booking
          : path === "/bookings" ? [booking, { ...booking, id: "second-booking", vehicleName: "Audi S3" }]
          : path === "/users/me/referrals" ? { coins: 100, rewardAmount: 100, referralCode: "PALAAACFF2A", referredUsers: [] }
          : path === "/catalog/promo-banners" ? [{ id: "offer", title: "Doorstep car care", subtitle: "A clean car, without the wait.", imageUrl: "/logo.png", ctaLabel: "Book a wash", ctaLink: "/app/book" }]
          : path === "/catalog/time-slots" ? { slots: ["10:00 AM"] }
          : path === "/chat/config" ? { isOnline: true }
          : path === "/chat/tickets" ? [{ id: "layout-ticket", subject: "Payments & refunds", topic: "payment", status: "open", updatedAt: job.date }]
          : path === "/catalog/vehicle-categories" ? [{ id: "hatchback", key: "hatchback", name: "Hatchback", basePrice: 400, active: true }]
          : path === "/auth/me" || path === "/agent/heartbeat" ? profile
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
      if (heading === "chat") {
        await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
        if (width < 400) await page.setViewportSize({ width, height: 480 });
        await page.getByRole("textbox", { name: "Message" }).fill("Hello, I need help with my payment");
        await expect(page.getByRole("button", { name: "Send", exact: true })).toBeInViewport();
      } else if (route === "/app") {
        await expect(page.getByRole("heading", { level: 1 })).toContainText("Palak");
      } else {
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      }
      if (route.endsWith("/invoice")) {
        await expect(page.getByTestId("invoice-document")).toContainText("NexClean");
        const box = await page.getByTestId("invoice-document").boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      if (route === "/app") {
        await expect(page.getByRole("heading", { name: "Special Offers" })).toBeVisible();
        await expect(page.getByText("Premium", { exact: true })).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("layout.png"), fullPage: true, animations: "disabled" });
    });
  }
}

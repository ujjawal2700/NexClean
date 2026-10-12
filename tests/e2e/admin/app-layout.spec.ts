import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

// Read-only traversal against the local test backend; forms are never submitted.
const routes = ["", "bookings", "dispatch", "agents", "agent-verification", "customers", "payments", "bookkeeping", "refunds", "agent-payouts", "payout-requests", "pricing", "area-alerts", "notifications", "plans", "locations", "vehicle-categories", "vehicle-brands", "promotions", "special-coupons", "off-peak-hours", "subscriptions", "time-slots", "referrals", "content", "leads", "reports", "roles", "profile", "support", "internal-messages"];
for (const viewport of [{ width: 360, height: 640 }, { width: 1280, height: 720 }]) {
  test(`all admin sections render without page overflow at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await loginAdminUI(page);
    for (const route of routes) {
      await test.step(route || "dashboard", async () => {
        await page.goto(`/admin${route ? `/${route}` : ""}`);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.locator("main").getByRole("heading").first()).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`/admin${route ? `/${route}` : ""}$`));
        await expect(page.getByText("This page hit an unexpected error", { exact: false })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(viewport.width);
        expect(errors, route).toEqual([]);
      });
    }
  });
}

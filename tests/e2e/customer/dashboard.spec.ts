import { test, expect, type Page } from "@playwright/test";
import { API_BASE_URL } from "../../playwright.config";

const me = {
  id: "customer-1",
  name: "Dashboard Customer",
  phone: "9999999999",
  role: "customer",
  vehicles: [],
  addresses: [],
  activePlan: null,
};

const plans = [
  {
    id: "premium",
    name: "Premium Care",
    prices: { hatchback: 799, sedan: 899, suv: 999, luxury: 1299, premium: 1499 },
    price: 799,
    washesPerMonth: 4,
    active: true,
  },
];

async function openDashboard(page: Page, bookings: unknown[]) {
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = null;
    if (path.endsWith("/auth/me")) data = me;
    else if (path.endsWith("/bookings")) data = bookings;
    else if (path.endsWith("/catalog/plans")) data = plans;
    else if (path.endsWith("/catalog/vehicle-categories")) data = [];
    else if (path.endsWith("/catalog/promo-banners")) data = [];
    else if (path.endsWith("/notifications")) data = [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "nexclean-session",
      JSON.stringify({ state: { authenticated: true, guest: false }, version: 0 }),
    );
    localStorage.setItem(
      "nexclean-cookie-consent",
      JSON.stringify({ version: 1, necessary: true, functional: false, updatedAt: new Date().toISOString() }),
    );
  });
  await page.goto("/app");
}

test.describe("Customer dashboard history-aware empty state", () => {
  test("shows the first-cleaning CTA only when booking history is empty", async ({ page }) => {
    await openDashboard(page, []);
    await expect(page.getByRole("link", { name: "Book your first clean" })).toBeVisible();
    await expect(page.getByTestId("returning-customer-memberships")).toHaveCount(0);
  });

  test("shows membership plans to a returning customer with no upcoming booking", async ({ page }) => {
    await openDashboard(page, [
      {
        id: "booking-1",
        status: "completed",
        packageName: "Express Wash",
        vehicleName: "Previous Car",
        date: "2026-01-01T10:00:00.000Z",
        slot: "11:00 AM",
        addressLabel: "Home",
      },
    ]);

    await expect(page.getByRole("link", { name: "Book your first clean" })).toHaveCount(0);
    await expect(page.getByText("Membership plans", { exact: true })).toBeVisible();
    await expect(page.getByText("Premium Care", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Explore all plans/ })).toBeVisible();
  });
});

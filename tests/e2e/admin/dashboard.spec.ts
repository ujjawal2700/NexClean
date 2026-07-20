import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
  });

  test("loads without error and shows numeric stat tiles", async ({ page }) => {
    await expect(page.locator("h1")).toHaveText("Dashboard");
    await expect(page.getByText("Operations overview at a glance.")).toBeVisible();

    // Stat tiles reflecting GET /admin/stats.
    await expect(page.getByText("Total users")).toBeVisible();
    await expect(page.getByText("Revenue (completed)")).toBeVisible();
    await expect(page.getByText("Active bookings")).toBeVisible();
    await expect(page.getByText("Active services")).toBeVisible();
    await expect(page.getByText("Agents online")).toBeVisible();
    await expect(page.getByText("Alerts triggered")).toBeVisible();
  });

  test("shows the revenue chart and recent bookings sections", async ({ page }) => {
    await expect(page.getByText("Revenue", { exact: true })).toBeVisible();
    await expect(page.getByText("Last 7 days")).toBeVisible();
    await expect(page.getByText("Recent bookings")).toBeVisible();
    await expect(page.getByText("Recent area alerts")).toBeVisible();
  });

  test("View all navigates to the Bookings page", async ({ page }) => {
    await page.getByRole("link", { name: /View all/i }).click();
    await expect(page).toHaveURL(/\/admin\/bookings$/);
    await expect(page.locator("h1")).toHaveText("Bookings");
  });
});

import { test, expect } from "@playwright/test";

/**
 * "Skip login" browse mode: the dashboard and plans open without an account,
 * everything else bounces to the login and returns you there afterwards.
 */
test.describe("Customer guest browsing", () => {
  const skip = async (page: import("@playwright/test").Page) => {
    await page.goto("/app/login");
    await page.getByRole("button", { name: "Skip for now, just browse" }).click();
    await page.waitForURL(/\/app$/);
  };

  test("skipping login lands on the dashboard as a guest", async ({ page }) => {
    await skip(page);
    await expect(page.getByRole("heading", { name: /Guest/ })).toBeVisible();
    await expect(page.getByText("You're browsing as a guest", { exact: false })).toBeVisible();
  });

  test("a guest can open the plans screen", async ({ page }) => {
    await skip(page);
    await page.goto("/app/plans");
    await expect(page).toHaveURL(/\/app\/plans$/);
    await expect(page.getByRole("heading", { name: "Subscription plans" })).toBeVisible();
  });

  for (const path of ["/app/book", "/app/bookings", "/app/profile"]) {
    test(`a guest visiting ${path} is sent to the login`, async ({ page }) => {
      await skip(page);
      await page.goto(path);
      await page.waitForURL(/\/app\/login$/);
      await expect(page.locator("h1")).toHaveText("Welcome back");
    });
  }

  test("the locked tabs take a guest to the login", async ({ page }) => {
    await skip(page);
    await page.getByRole("button", { name: "Bookings — login required" }).click();
    await page.waitForURL(/\/app\/login$/);
    await expect(page.locator("h1")).toHaveText("Welcome back");
  });
});

import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin reports & analytics", () => {
  test("dashboard loads with revenue trend, agent performance, and retention stats", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await loginAdminUI(page);
    await page.goto("/admin/reports");
    await expect(page.locator("h1")).toHaveText("Reports & Analytics");

    // Exact matches throughout: the empty-state copy ("Revenue trends appear
    // here automatically…") also contains these headings as substrings.
    await expect(page.getByText("Revenue trend", { exact: true })).toBeVisible();
    await expect(page.getByText("Revenue by vehicle type", { exact: true })).toBeVisible();
    await expect(page.getByText("Top societies", { exact: true })).toBeVisible();
    await expect(page.getByText("Agent performance", { exact: true })).toBeVisible();
    await expect(page.getByText("Customer retention", { exact: true })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});

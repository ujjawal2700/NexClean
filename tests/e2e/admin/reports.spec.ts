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

    await expect(page.getByText("Revenue trend")).toBeVisible();
    await expect(page.getByText("Revenue by vehicle type")).toBeVisible();
    await expect(page.getByText("Top societies")).toBeVisible();
    await expect(page.getByText("Agent performance")).toBeVisible();
    await expect(page.getByText("Customer retention")).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});

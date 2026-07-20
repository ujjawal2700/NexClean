import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin Smart Area Alert settings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/area-alerts");
    await expect(page.locator("h1")).toHaveText("Smart Area Alert");
  });

  test("changing title and window and saving persists across reload", async ({ page }) => {
    const newTitle = `NexClean Nearby ${Date.now()}`;
    const newWindow = String(15 + Math.floor(Math.random() * 30));

    await page.locator('input[name="title"]').fill(newTitle);
    await page.locator('input[name="window"]').fill(newWindow);

    const saveResponse = page.waitForResponse(
      (res) => res.url().includes("/area-alerts/settings") && res.request().method() === "PUT",
    );
    await page.getByRole("button", { name: /Save settings/ }).click();
    await saveResponse;
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    await page.reload();
    await expect(page.locator("h1")).toHaveText("Smart Area Alert");
    await expect(page.locator('input[name="title"]')).toHaveValue(newTitle);
    await expect(page.locator('input[name="window"]')).toHaveValue(newWindow);
  });

  test("toggle switch and radius slider are interactive", async ({ page }) => {
    const toggle = page.locator('[role="switch"]');
    await expect(toggle).toBeVisible();
    const before = await toggle.getAttribute("aria-checked");
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("aria-checked", before ?? "");

    const slider = page.locator('input[type="range"]');
    await slider.fill("2");
    await expect(slider).toHaveValue("2");
  });
});

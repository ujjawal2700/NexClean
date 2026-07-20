import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin content management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/content");
    await expect(page.locator("h1")).toHaveText("Content");
  });

  test("editing a Pages tab field and saving fires PUT /admin/content and flips to Saved", async ({ page }) => {
    // Switch to the "Pages" tab (low-risk, isolated from footer/landing nav content).
    await page.getByRole("button", { name: "Pages" }).click();
    await expect(page.getByRole("button", { name: "About" })).toBeVisible();

    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible();
    const newTitle = `About NexClean ${Date.now()}`;
    await titleInput.fill(newTitle);

    const saveResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/content") && res.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Save changes" }).click();
    const res = await saveResponse;
    expect(res.ok()).toBeTruthy();

    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  });

  test("tab bar switches between Footer/Pages/Landing/Contact/Help", async ({ page }) => {
    for (const tab of ["Footer", "Pages", "Landing page", "Contact", "Help / FAQs"]) {
      await page.getByRole("button", { name: tab }).click();
    }
  });
});

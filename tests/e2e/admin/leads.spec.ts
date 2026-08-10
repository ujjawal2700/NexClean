import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { freshPhone } from "../../fixtures/api-client";
import { apiContext } from "../../fixtures/admin-e2e-config-helpers";
import { API_BASE_URL } from "../../playwright.config";

test.describe("Admin leads", () => {
  test("seeded lead is visible, searchable, and deletable", async ({ page }) => {
    const name = `LeadTest${Date.now()}`;
    const city = `LeadCity${Date.now()}`;
    const phone = freshPhone();

    // Dedicated API-bound request context (no baseURL — see admin-e2e-config-helpers.ts
    // for why every call here must use a full absolute URL, not a relative path).
    const api = await apiContext();
    const createRes = await api.post(`${API_BASE_URL}/leads`, {
      data: { name, phone, email: "lead@example.com", city, location: "Test Society" },
    });
    expect(createRes.ok()).toBeTruthy();
    await api.dispose();

    await loginAdminUI(page);
    await page.goto("/admin/leads");
    await expect(page.locator("h1")).toHaveText("Leads");

    await expect(page.getByText(name)).toBeVisible();
    // City appears both as the group heading and inline on the lead card — just assert it renders somewhere.
    await expect(page.getByText(city, { exact: true }).first()).toBeVisible();

    // Search narrows the list to the seeded lead.
    await page.locator('input[name="lead-search"]').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    // Delete fires immediately (no confirm dialog). The search above has
    // narrowed the list to this one lead, so the only delete control on screen
    // is its own — target it by title rather than walking up the DOM, which
    // broke when the lead card markup changed.
    const deleteResponse = page.waitForResponse(
      (res) => /\/admin\/leads\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "DELETE",
    );
    await page.getByTitle("Delete lead").first().click();
    await deleteResponse;
    await expect(page.getByText(name)).toHaveCount(0);
  });
});

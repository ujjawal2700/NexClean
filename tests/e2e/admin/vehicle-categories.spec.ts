import { test, expect } from "@playwright/test";
import { loginAdminUI, autoAcceptNextDialog } from "../../fixtures/ui-helpers";
import { cardByText, pinCardByText } from "../../fixtures/admin-e2e-config-helpers";

test.describe("Admin vehicle categories", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/vehicle-categories");
    await expect(page.locator("h1")).toHaveText("Vehicle Categories");
  });

  test("full CRUD: create, edit, toggle active, delete a category", async ({ page }) => {
    const catName = `TestCat${Date.now()}`;

    await page.getByRole("button", { name: "New category" }).click();
    await page.locator('input[name="catName"]').fill(catName);
    await page.locator('input[name="catPrice"]').fill("399");

    const createResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/vehicle-categories") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create category" }).click();
    await createResponse;

    await expect(cardByText(page, catName)).toBeVisible();
    // Pin a positional locator to this card now, while its name is still
    // plain text — once "Edit" is clicked the name becomes an <input
    // value="...">, and an input's value isn't part of textContent, so a
    // live hasText-filtered locator would lose the match.
    const card = await pinCardByText(page, catName);
    await expect(card.getByText("₹399 base price")).toBeVisible();

    // Edit: change the price.
    await card.getByRole("button", { name: "Edit" }).click();
    const priceInput = card.locator('input[type="number"]');
    await priceInput.fill("499");
    const updateResponse = page.waitForResponse(
      (res) => /\/admin\/vehicle-categories\//.test(res.url()) && res.request().method() === "PATCH",
    );
    await card.getByRole("button", { name: "Save" }).click();
    await updateResponse;
    await expect(card.getByText("₹499 base price")).toBeVisible();

    // Toggle active/inactive.
    const toggleResponse = page.waitForResponse(
      (res) => /\/admin\/vehicle-categories\//.test(res.url()) && res.request().method() === "PATCH",
    );
    await card.getByRole("button", { name: "Active" }).click();
    await toggleResponse;
    await expect(card.getByRole("button", { name: "Inactive" })).toBeVisible();

    // Delete (native confirm dialog).
    autoAcceptNextDialog(page);
    const deleteResponse = page.waitForResponse(
      (res) => /\/admin\/vehicle-categories\//.test(res.url()) && res.request().method() === "DELETE",
    );
    await card.getByRole("button").last().click();
    await deleteResponse;
    await expect(cardByText(page, catName)).toHaveCount(0);
  });
});

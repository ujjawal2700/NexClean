import { test, expect } from "@playwright/test";
import { loginAdminUI, autoAcceptNextDialog } from "../../fixtures/ui-helpers";
import { cardByText } from "../../fixtures/admin-e2e-config-helpers";

test.describe("Admin subscription plans", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/plans");
    await expect(page.locator("h1")).toHaveText("Subscriptions");
  });

  test("full CRUD: create, edit washes, deactivate, delete a plan", async ({ page }) => {
    // Five sequential round-trips (create, edit, deactivate, delete + refetches);
    // the 30s default ran out under full-suite load.
    test.setTimeout(90_000);
    const planName = `Test Plan ${Date.now()}`;

    await page.getByRole("button", { name: "New plan" }).click();
    await page.locator('input[name="name"]').fill(planName);
    await page.locator('input[name="washesPerMonth"]').fill("4");

    // Per-category price inputs are unnamed and required to be > 0 by the
    // backend (`z.number().positive()`) — leaving them blank (→ 0) makes
    // the create request fail validation with a 400, silently leaving the
    // form open. Fill every one of them.
    const newPlanForm = page.locator(".glass").filter({ hasText: "New plan" });
    const priceInputs = newPlanForm.locator('input[type="number"]:not([name="washesPerMonth"])');
    // The per-category inputs render only once vehicle categories have loaded.
    // Counting before then found none, filled nothing, and the create 400'd.
    await expect(priceInputs.first()).toBeVisible({ timeout: 15_000 });
    const priceInputCount = await priceInputs.count();
    for (let i = 0; i < priceInputCount; i++) {
      await priceInputs.nth(i).fill("199");
    }

    const createResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/plans") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create plan" }).click();
    const created = await createResponse;
    expect(created.ok(), `create plan failed: ${await created.text()}`).toBeTruthy();

    const card = cardByText(page, planName);
    await expect(card).toBeVisible();
    await expect(card.getByText("4/mo washes")).toBeVisible();

    // Edit: bump washes per month.
    await card.getByRole("button", { name: "Edit" }).click();
    const washesInput = card.locator('input[type="number"]').last();
    await washesInput.fill("8");
    const updateResponse = page.waitForResponse(
      (res) => /\/admin\/plans\//.test(res.url()) && res.request().method() === "PATCH",
    );
    await card.getByRole("button", { name: "Save" }).click();
    await updateResponse;
    await expect(card.getByText("8/mo washes")).toBeVisible();

    // Deactivate.
    const deactivateResponse = page.waitForResponse(
      (res) => /\/admin\/plans\//.test(res.url()) && res.request().method() === "PATCH",
    );
    await card.getByRole("button", { name: "Deactivate" }).click();
    await deactivateResponse;
    await expect(card.getByRole("button", { name: "Activate" })).toBeVisible();

    // Delete (native confirm dialog).
    autoAcceptNextDialog(page);
    const deleteResponse = page.waitForResponse(
      (res) => /\/admin\/plans\//.test(res.url()) && res.request().method() === "DELETE",
    );
    await card.getByRole("button").last().click(); // trash icon button
    await deleteResponse;
    await expect(cardByText(page, planName)).toHaveCount(0);
  });
});

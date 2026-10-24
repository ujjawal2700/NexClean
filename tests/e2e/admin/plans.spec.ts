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

    await page.getByLabel("Wash type").selectOption({ index: 1 });
    await page.getByLabel("Discount (%)").fill("20");
    await expect(page.getByRole("status", { name: /monthly price/ }).first()).toBeVisible();

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
    const washesInput = card.getByLabel("Washes / month");
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

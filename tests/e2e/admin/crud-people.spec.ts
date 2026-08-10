import { test, expect, type Page } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

/**
 * Admin-panel create/edit/delete for agents and customers.
 *
 * Each test uses its own phone number and cleans up after itself, so a rerun
 * doesn't trip the "phone already in use" guard on the second pass. Fixture
 * names are letters-only because that's what the name field accepts — an
 * "E2E" prefix would fail validation before ever reaching the server.
 */

/** Unique 10-digit phone in the 8xxxxxxxxx range the seed data doesn't use. */
function uniquePhone(): string {
  return `8${String(Date.now()).slice(-9)}`;
}

async function fillPerson(page: Page, values: { name: string; phone?: string; email?: string; area?: string }) {
  await page.locator('input[name="personName"]').fill(values.name);
  if (values.phone !== undefined) await page.locator('input[name="personPhone"]').fill(values.phone);
  if (values.email !== undefined) await page.locator('input[name="personEmail"]').fill(values.email);
  if (values.area !== undefined) await page.locator('input[name="personArea"]').fill(values.area);
}

test.describe("Admin — agent CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/agents");
    await expect(page.locator("h1")).toHaveText("Agents");
  });

  test("creates, edits, then deletes an agent", async ({ page }) => {
    const phone = uniquePhone();

    await page.getByRole("button", { name: "Add agent" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await fillPerson(page, { name: "Zeta Test Agent", phone, email: "e2e.agent@example.com", area: "Vijay Nagar" });
    await page.getByRole("button", { name: "Create agent" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await page.locator('input[name="search"]').fill(phone);
    await expect(page.getByText("Zeta Test Agent")).toBeVisible();

    await page.getByRole("button", { name: "Edit Zeta Test Agent" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await fillPerson(page, { name: "Zeta Renamed Agent" });
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Zeta Renamed Agent")).toBeVisible();

    await page.getByRole("button", { name: "Delete Zeta Renamed Agent" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("No agents match your search.")).toBeVisible();
  });

  test("blocks a duplicate phone number and keeps the dialog open", async ({ page }) => {
    await page.getByRole("button", { name: "Add agent" }).click();
    // 9000000001 is the seeded verified agent.
    await fillPerson(page, { name: "Clashing Agent", phone: "9000000001" });
    await page.getByRole("button", { name: "Create agent" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/already uses this mobile number/i)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("validates the name and phone before hitting the server", async ({ page }) => {
    await page.getByRole("button", { name: "Add agent" }).click();
    await fillPerson(page, { name: "X", phone: "123" });
    await page.getByRole("button", { name: "Create agent" }).click();

    await expect(page.getByText("Letters only, at least 2 characters")).toBeVisible();
    await expect(page.getByText("Must be exactly 10 digits")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
  });
});

test.describe("Admin — customer CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/customers");
    await expect(page.locator("h1")).toHaveText("Customers");
  });

  test("creates, edits, then deletes a customer", async ({ page }) => {
    const phone = uniquePhone();

    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await fillPerson(page, { name: "Zeta Test Customer", phone, email: "e2e.customer@example.com" });
    await page.getByRole("button", { name: "Create customer" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await page.locator('input[name="search"]').fill(phone);
    await expect(page.getByText("Zeta Test Customer")).toBeVisible();

    await page.getByRole("button", { name: "Edit Zeta Test Customer" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await fillPerson(page, { name: "Zeta Renamed Customer" });
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Zeta Renamed Customer")).toBeVisible();

    await page.getByRole("button", { name: "Delete Zeta Renamed Customer" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("No customers match your filters.")).toBeVisible();
  });

  test("row actions don't navigate to the customer detail page", async ({ page }) => {
    const phone = uniquePhone();
    await page.getByRole("button", { name: "Add customer" }).click();
    await fillPerson(page, { name: "Zeta Stay Put", phone });
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.locator('input[name="search"]').fill(phone);
    await page.getByRole("button", { name: "Edit Zeta Stay Put" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/admin/customers");

    // Clean up so a rerun starts from the same state.
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Delete Zeta Stay Put" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

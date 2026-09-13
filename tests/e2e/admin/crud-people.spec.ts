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
  if (values.area !== undefined) await setArea(page, values.area);
}

/**
 * Area is a free-text input only while no cities are configured; once the
 * Locations specs have run it's a city → area pair of selects. The helper has
 * to cope with both, because project ordering decides which one this test sees.
 */
async function setArea(page: Page, area: string) {
  const textInput = page.locator('input[name="personArea"]');
  if (await textInput.count()) {
    await textInput.fill(area);
    return;
  }
  const citySelect = page.locator('select[name="personCity"]');
  const firstCity = await citySelect.locator("option").nth(1).getAttribute("value");
  if (!firstCity) return; // no cities to choose from — area stays blank, which is allowed
  await citySelect.selectOption(firstCity);

  const areaSelect = page.locator('select[name="personArea"]');
  const options = await areaSelect.locator("option").allTextContents();
  const match = options.find((o) => o === area);
  if (match) await areaSelect.selectOption({ label: match });
  else if (options.length > 1) await areaSelect.selectOption({ index: 1 });
}

/**
 * The delete confirmation dialog is now a two-step "Only" vs "with Data"
 * choice (PersonFormModal.tsx) instead of a single Delete button, for both
 * agents and customers. This drives the "with Data" path — a full,
 * unconditional removal — which is the closest match to the old single-click
 * delete these tests were written against.
 */
async function confirmHardDelete(page: Page, kind: "Agent" | "Customer") {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: `Delete ${kind} with Data` }).click();
  await dialog.getByRole("button", { name: `Yes, Delete ${kind} & All Data` }).click();
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
    await confirmHardDelete(page, "Agent");

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
    await confirmHardDelete(page, "Customer");

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
    await confirmHardDelete(page, "Customer");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test.describe("Admin — detail page actions", () => {
  test("agent detail: edit, then delete and land back on the list", async ({ page }) => {
    const phone = uniquePhone();
    await loginAdminUI(page);
    await page.goto("/admin/agents");
    await page.getByRole("button", { name: "Add agent" }).click();
    await fillPerson(page, { name: "Zeta Detail Agent", phone, area: "Vijay Nagar" });
    await page.getByRole("button", { name: "Create agent" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.locator('input[name="search"]').fill(phone);
    await page.getByRole("link", { name: /Zeta Detail Agent/ }).first().click();
    await expect(page.getByRole("heading", { name: "Zeta Detail Agent" })).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    await fillPerson(page, { name: "Zeta Detail Renamed" });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Zeta Detail Renamed" })).toBeVisible();

    // Suspend / Reinstate still work alongside the new actions, now behind a confirmation.
    await page.getByRole("button", { name: "Suspend", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Suspend", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reinstate" })).toBeVisible();
    await page.getByRole("button", { name: "Reinstate" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("button", { name: "Suspend", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await confirmHardDelete(page, "Agent");
    await expect(page).toHaveURL(/\/admin\/agents$/);
    await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
  });

  test("customer detail: edit, then delete and land back on the list", async ({ page }) => {
    const phone = uniquePhone();
    await loginAdminUI(page);
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Add customer" }).click();
    await fillPerson(page, { name: "Zeta Detail Customer", phone });
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.locator('input[name="search"]').fill(phone);
    const row = page.locator("tbody tr").filter({ hasText: "Zeta Detail Customer" });
    await expect(row).toBeVisible();
    await row.getByRole("cell").first().click();
    await expect(page).toHaveURL(/\/admin\/customers\/[a-f0-9]{24}$/);

    await page.getByRole("button", { name: "Edit" }).click();
    await fillPerson(page, { name: "Zeta Detail Renamed" });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Zeta Detail Renamed" })).toBeVisible();

    // Suspend / Reactivate still work alongside the new actions.
    await page.getByRole("button", { name: "Suspend" }).click();
    await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();
    await page.getByRole("button", { name: "Reactivate" }).click();
    await expect(page.getByRole("button", { name: "Suspend" })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await confirmHardDelete(page, "Customer");
    await expect(page).toHaveURL(/\/admin\/customers$/);
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  });
});

test.describe("Admin — richer forms and verification", () => {
  test("the agent form exposes area, verification status and Aadhaar", async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/agents");
    await page.getByRole("button", { name: "Add agent" }).click();

    const dialog = page.getByRole("dialog");
    for (const field of ["personName", "personPhone", "personEmail", "personArea", "personAadhar"]) {
      await expect(dialog.locator(`[name="${field}"]`)).toBeVisible();
    }
    await expect(dialog.locator('select[name="personAgentStatus"]')).toBeVisible();

    // Area is a picker driven by Locations, and only unlocks after a city.
    // (It falls back to a text input when no cities are configured at all.)
    const cityPicker = dialog.locator('select[name="personCity"]');
    if (await cityPicker.count()) {
      await expect(dialog.locator('select[name="personArea"]')).toBeDisabled();
      const firstCity = await cityPicker.locator("option").nth(1).getAttribute("value");
      await cityPicker.selectOption(firstCity!);
      await expect(dialog.locator('select[name="personArea"]')).toBeEnabled();
    }

    // Aadhaar is validated client-side before any round trip.
    const phone = uniquePhone();
    await fillPerson(page, { name: "Zeta Aadhaar Agent", phone });
    await dialog.locator('[name="personAadhar"]').fill("12345");
    await page.getByRole("button", { name: "Create agent" }).click();
    await expect(page.getByText("Must be exactly 12 digits")).toBeVisible();

    await dialog.locator('[name="personAadhar"]').fill("123456789012");
    // The picker warns that "pending" routes them elsewhere, so this is the
    // behaviour worth pinning rather than a surprise.
    await dialog.locator('select[name="personAgentStatus"]').selectOption("pending");
    await expect(dialog.getByText("Queues under Agent Verification, not the Agents list")).toBeVisible();
    await dialog.locator('select[name="personAgentStatus"]').selectOption("verified");
    await page.getByRole("button", { name: "Create agent" }).click();
    await expect(dialog).toBeHidden();

    await page.locator('input[name="search"]').fill(phone);
    await expect(page.getByText("Zeta Aadhaar Agent")).toBeVisible();

    await page.getByRole("button", { name: "Delete Zeta Aadhaar Agent" }).click();
    await confirmHardDelete(page, "Agent");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the customer form exposes status, address and vehicle", async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Add customer" }).click();

    const dialog = page.getByRole("dialog");
    for (const field of ["personAddressLabel", "personAddressLine", "personAddressSociety", "personVehicleName", "personVehiclePlate"]) {
      await expect(dialog.locator(`[name="${field}"]`)).toBeVisible();
    }
    await expect(dialog.locator('select[name="personStatus"]')).toBeVisible();
    await expect(dialog.locator('select[name="personVehicleType"]')).toBeVisible();

    const phone = uniquePhone();
    await fillPerson(page, { name: "Zeta Full Customer", phone });
    await dialog.locator('[name="personAddressLine"]').fill("42 Ring Road");
    await dialog.locator('[name="personVehicleName"]').fill("City ZX");
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(dialog).toBeHidden();

    // The address and vehicle made it onto the record.
    await page.locator('input[name="search"]').fill(phone);
    const row = page.locator("tbody tr").filter({ hasText: "Zeta Full Customer" });
    await row.getByRole("cell").first().click();
    await expect(page.getByText("42 Ring Road")).toBeVisible();
    await expect(page.getByText("City ZX")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await confirmHardDelete(page, "Customer");
    await expect(page).toHaveURL(/\/admin\/customers$/);
  });

  test("changing an agent's verification asks for confirmation first", async ({ page }) => {
    const phone = uniquePhone();
    await loginAdminUI(page);
    await page.goto("/admin/agents");
    await page.getByRole("button", { name: "Add agent" }).click();
    await fillPerson(page, { name: "Zeta Confirm Agent", phone });
    await page.getByRole("button", { name: "Create agent" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.locator('input[name="search"]').fill(phone);
    await page.getByRole("link", { name: /Zeta Confirm Agent/ }).first().click();
    await expect(page).toHaveURL(/\/admin\/agents\/[a-f0-9]{24}$/);

    // The detail page states the verification status outright. Scoped, because
    // "Suspend"/"Suspended" also appear as filter pills back on the list.
    const panel = page.locator("div.glass").filter({ hasText: "Verification" }).first();
    await expect(panel.getByText("Verified", { exact: true })).toBeVisible();

    // Cancelling leaves the status untouched.
    await page.getByRole("button", { name: "Suspend", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Suspend this agent?" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(panel.getByText("Verified", { exact: true })).toBeVisible();

    // Confirming applies it.
    await page.getByRole("button", { name: "Suspend", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Suspend", exact: true }).click();
    await expect(panel.getByText("Suspended", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Reinstate" }).click();
    await expect(page.getByRole("heading", { name: "Verify this agent?" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Verify", exact: true }).click();
    await expect(panel.getByText("Verified", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await confirmHardDelete(page, "Agent");
    await expect(page).toHaveURL(/\/admin\/agents$/);
  });
});


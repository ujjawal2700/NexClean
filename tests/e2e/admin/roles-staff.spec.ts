import { test, expect } from "@playwright/test";
import { loginAdminUI, autoAcceptNextDialog } from "../../fixtures/ui-helpers";
import { cardByText } from "../../fixtures/admin-e2e-config-helpers";

test.describe("Admin role & staff management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/roles");
    await expect(page.locator("h1")).toHaveText("Role & Staff Management");
  });

  test("create a role, create staff assigned to it, delete staff, then the role (deleting the role first must fail with 400)", async ({
    page,
  }) => {
    const roleName = `E2E Role ${Date.now()}`;
    const staffEmail = `staff-e2e-${Date.now()}@example.com`;
    const staffName = `E2E Staff ${Date.now()}`;

    // --- Create role with a couple of permissions ---
    await expect(page.getByRole("button", { name: "Roles & Permissions" })).toBeVisible();
    await page.getByRole("button", { name: "Create Role" }).click();
    await page.locator('input[name="roleName"]').fill(roleName);
    // The permission checkboxes are visually-hidden (`sr-only`) inputs
    // overlapped by a decorative checkmark div at the same coordinates, so
    // a direct .check() on the input gets blocked by "intercepts pointer
    // events". Click the visible label text instead (native label
    // behavior toggles the wrapped checkbox) — scoped to the "Section
    // Permissions" card, since the sidebar nav also has a "Leads" link.
    const roleForm = page.locator(".glass").filter({ hasText: "Section Permissions" });
    await roleForm.getByText("Leads", { exact: true }).click();
    await roleForm.getByText("Analytics Reports", { exact: true }).click();

    const createRoleResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/roles") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save Role" }).click();
    await createRoleResponse;

    const roleCard = cardByText(page, roleName);
    await expect(roleCard).toBeVisible();

    // --- Attempt to delete the role BEFORE any staff exists: should succeed if unused.
    // We instead first prove the "assigned role can't be deleted" rule by creating
    // staff against it, so skip straight to staff creation.

    // --- Create a staff account assigned to the new role ---
    await page.getByRole("button", { name: "Staff Accounts" }).click();
    await page.getByRole("button", { name: "Add Staff Account" }).click();
    await page.locator('input[name="staffName"]').fill(staffName);
    await page.locator('input[name="staffEmail"]').fill(staffEmail);
    await page.locator('input[name="staffPassword"]').fill("Passw0rd!23");
    await page.locator("select").selectOption({ label: roleName });

    const createStaffResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/staff") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save Account" }).click();
    await createStaffResponse;

    // Staff table row: the email <td> is the matched element itself; its parent <tr> holds the action buttons.
    const staffRow = page.getByText(staffEmail, { exact: true }).locator("xpath=..");
    await expect(staffRow).toBeVisible();

    // --- Deleting the role while staff is assigned to it must fail with 400 ---
    await page.getByRole("button", { name: "Roles & Permissions" }).click();
    autoAcceptNextDialog(page);
    const blockedDeleteResponse = page.waitForResponse(
      (res) => /\/admin\/roles\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "DELETE",
    );
    await roleCard.locator('button[title="Delete Role"]').click();
    const blockedRes = await blockedDeleteResponse;
    expect(blockedRes.status()).toBe(400);
    await expect(cardByText(page, roleName)).toBeVisible(); // still present

    // --- Delete the staff account first ---
    await page.getByRole("button", { name: "Staff Accounts" }).click();
    autoAcceptNextDialog(page);
    const deleteStaffResponse = page.waitForResponse(
      (res) => /\/admin\/staff\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "DELETE",
    );
    await staffRow.locator('button[title="Delete Staff"]').click();
    const deleteStaffRes = await deleteStaffResponse;
    expect(deleteStaffRes.ok()).toBeTruthy();
    await expect(page.getByText(staffEmail, { exact: true })).toHaveCount(0);

    // --- Now delete the role — should succeed ---
    await page.getByRole("button", { name: "Roles & Permissions" }).click();
    autoAcceptNextDialog(page);
    const deleteRoleResponse = page.waitForResponse(
      (res) => /\/admin\/roles\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "DELETE",
    );
    await cardByText(page, roleName).locator('button[title="Delete Role"]').click();
    const deleteRoleRes = await deleteRoleResponse;
    expect(deleteRoleRes.ok()).toBeTruthy();
    await expect(cardByText(page, roleName)).toHaveCount(0);
  });
});

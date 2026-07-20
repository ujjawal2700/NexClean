import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { seedPendingAdminBooking } from "../../fixtures/admin-e2e-ops-helpers";

test.describe("Admin Dispatch", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
  });

  test("h1 includes Dispatch and the live badge renders", async ({ page }) => {
    await page.goto("/admin/dispatch");
    await expect(page.locator("h1")).toContainText("Dispatch");
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
  });

  test("a booking with no coordinates lands in the queue as 'Needs assignment' and can be manually assigned via the dropdown", async ({
    page,
    request,
  }) => {
    const marker = `dispatch-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const { booking } = await seedPendingAdminBooking(request, marker);

    await page.goto("/admin/dispatch");
    const row = page.locator("div.glass", { hasText: marker });
    // Poll — the queue refetches every 15s but our own navigation triggers a fresh fetch too.
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText("Needs assignment")).toBeVisible();

    // Open the Assign dropdown — this fetches GET /admin/bookings/:id/assignable-agents.
    const assignableAgentsPromise = page.waitForResponse(
      (r) => r.url().includes(`/admin/bookings/${booking.id}/assignable-agents`),
    );
    await row.getByRole("button", { name: /Assign/i }).click();
    const assignableAgentsResp = await assignableAgentsPromise;
    expect(assignableAgentsResp.ok()).toBeTruthy();

    const dropdown = row.locator("div.absolute");
    await expect(dropdown).toBeVisible();

    const agentButtons = dropdown.locator("button");
    const count = await agentButtons.count();
    test.skip(count === 0, "No verified cleaners available to assign in this environment");

    const assignRespPromise = page.waitForResponse(
      (r) => r.url().includes(`/admin/bookings/${booking.id}/assign`) && r.request().method() === "PATCH",
    );
    await agentButtons.first().click();
    const assignResp = await assignRespPromise;
    expect(assignResp.ok()).toBeTruthy();
  });

  test("a booking with no location shows the 'No location' badge and a disabled Auto button", async ({ page, request }) => {
    const marker = `dispatch-auto-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await seedPendingAdminBooking(request, marker);

    await page.goto("/admin/dispatch");
    const row = page.locator("div.glass", { hasText: marker });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText("No location")).toBeVisible();

    // Auto-assign can't work without coordinates — the button must be disabled, not silently no-op.
    const autoBtn = row.getByRole("button", { name: /Auto/i });
    await expect(autoBtn).toBeDisabled();
  });
});

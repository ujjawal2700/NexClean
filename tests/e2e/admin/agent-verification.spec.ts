import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { seedPendingAgent } from "../../fixtures/admin-e2e-ops-helpers";

test.describe("Admin Agent Verification", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/agent-verification");
    await expect(page.locator("h1")).toHaveText("Agent Verification");
  });

  test("a freshly self-signed-up agent appears in the pending list and can be verified", async ({ page, request }) => {
    // Self-contained: create our own pending agent instead of relying on the
    // shared seed (another parallel test/agent may have already verified it).
    const { name } = await seedPendingAgent(request, "Verify E2E Agent");

    await page.reload();
    await page.locator('input[name="search"]').fill(name);
    const card = page.locator("div.glass", { hasText: name });
    await expect(card).toBeVisible();
    await expect(card.getByText("pending")).toBeVisible();

    const verifyRespPromise = page.waitForResponse(
      (r) => /\/admin\/agents\/.+\/status$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await card.getByRole("button", { name: "Verify Agent" }).click();
    const verifyResp = await verifyRespPromise;
    expect(verifyResp.ok()).toBeTruthy();

    // After verifying, the agent should disappear from the pending list.
    await expect(page.locator("div.glass", { hasText: name })).toHaveCount(0);
  });

  test("shows KYC Aadhar details for a pending agent", async ({ page, request }) => {
    const { name } = await seedPendingAgent(request, "KYC E2E Agent");

    await page.reload();
    await page.locator('input[name="search"]').fill(name);
    const card = page.locator("div.glass", { hasText: name });
    await expect(card).toBeVisible();
    await expect(card.getByText(/Aadhar:/)).toBeVisible();
    await expect(card.getByText("123456789012")).toBeVisible();
  });

  test("the 'View details' arrow link navigates to the agent detail page", async ({ page, request }) => {
    const { name } = await seedPendingAgent(request, "Detail Link E2E Agent");

    await page.reload();
    await page.locator('input[name="search"]').fill(name);
    const card = page.locator("div.glass", { hasText: name });
    await expect(card).toBeVisible();

    await card.getByRole("link", { name: "View details" }).click();
    await expect(page).toHaveURL(/\/admin\/agents\/[^/]+$/);
    await expect(page.locator("h1")).toHaveText(name);
  });
});

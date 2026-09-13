import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { uniqueName } from "../../fixtures/api-client";
import { apiContext, loginAsFreshCustomer, setCustomerName } from "../../fixtures/admin-e2e-config-helpers";

test.describe("Admin special coupons", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/special-coupons");
    await expect(page.locator("h1")).toHaveText("Special Coupons");
  });

  test("generate coupons, toggle active, and assign one to a customer", async ({ page }) => {
    // Seed a findable customer up front via a dedicated API-bound request
    // context (no baseURL — see admin-e2e-config-helpers.ts for why every
    // call must use a full absolute URL) — done before the assign panel's
    // customer list is ever fetched, so it isn't served stale data.
    const api = await apiContext();
    const { token: customerToken } = await loginAsFreshCustomer(api);
    const customerName = uniqueName("Coupon Customer");
    await setCustomerName(api, customerToken, customerName);
    await api.dispose();

    // The customers list was already fetched once by `beforeEach`'s page
    // load (before this customer existed) — reload so the assign panel's
    // search sees fresh data including the newly seeded customer.
    await page.reload();
    await expect(page.locator("h1")).toHaveText("Special Coupons");

    await page.getByRole("button", { name: "Generate coupons" }).click();
    await page.locator('input[name="count"]').fill("2");
    await page.locator('input[name="value"]').fill("10");

    const generateResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/special-coupons/generate") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Generate \d+ coupon/ }).click();
    const genRes = await generateResponse;
    const body = (await genRes.json()) as { data: { id: string; code: string }[] };
    expect(body.data.length).toBe(2);
    const [couponA, couponB] = body.data;

    // Coupon row root: the code <p> lives 4 levels below the row's outer div,
    // which also contains the action buttons and (once opened) the assign panel.
    const rowFor = (code: string) => page.getByText(code, { exact: true }).locator("xpath=../../../..");

    const rowA = rowFor(couponA.code);
    await expect(rowA).toBeVisible();

    // --- Toggle active -> inactive on the first coupon ---
    const toggleResponse = page.waitForResponse(
      (res) => res.url().includes(`/admin/special-coupons/${couponA.id}/toggle-active`) && res.request().method() === "PATCH",
    );
    await rowA.getByRole("button", { name: "Active" }).click();
    await toggleResponse;
    await expect(rowA.getByRole("button", { name: "Inactive" })).toBeVisible();

    // --- Assign the second coupon to the seeded customer ---
    const rowB = rowFor(couponB.code);
    await rowB.getByRole("button", { name: /Assign/ }).click();
    await rowB.getByPlaceholder("Search customer by name, phone, or email…").fill(customerName);
    const match = rowB.locator("button").filter({ hasText: customerName });
    await expect(match).toBeVisible();

    const assignResponse = page.waitForResponse(
      (res) => res.url().includes(`/admin/special-coupons/${couponB.id}/assign`) && res.request().method() === "PATCH",
    );
    await match.click();
    await assignResponse;
    await expect(rowB.getByText(`Assigned to ${customerName}`, { exact: false })).toBeVisible();
  });

  test("Export Excel asks for a date range, then downloads an .xlsx workbook", async ({ page }) => {
    // A fresh batch guarantees the export button (disabled when the list is
    // empty) is enabled, regardless of what else is in the shared dev DB.
    await page.getByRole("button", { name: "Generate coupons" }).click();
    await page.locator('input[name="count"]').fill("1");
    await page.locator('input[name="value"]').fill("10");
    const generateResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/special-coupons/generate") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Generate \d+ coupon/ }).click();
    await generateResponse;

    await page.getByRole("button", { name: /Export Excel/i }).click();
    await expect(page.getByText("Export Special Coupons")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^nexclean-special-coupons-.+\.xlsx$/);
  });
});

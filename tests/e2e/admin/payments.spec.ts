import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { forcePaymentPaidByBookingId, seedPayment } from "../../fixtures/admin-e2e-ops-helpers";

test.describe("Admin Payments", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
  });

  test("loads the payments list and stat tiles", async ({ page, request }) => {
    await seedPayment(request);

    await page.goto("/admin/payments");
    await expect(page.locator("h1")).toHaveText("Payments");
    await expect(page.getByText("Total collected")).toBeVisible();
    await expect(page.getByText("Total refunded")).toBeVisible();
    await expect(page.getByText("Pending settlement")).toBeVisible();
    await expect(page.getByText("Settled to agents")).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("search filters the payments table down to nothing for a bogus query, and clearing restores it", async ({
    page,
    request,
  }) => {
    await seedPayment(request);

    await page.goto("/admin/payments");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();

    await page.locator('input[name="search"]').fill("zzz-no-such-payment-zzz");
    await expect(page.getByText("No payments match your search.")).toBeVisible();

    // Don't assert an exact row count here: other agents' suites write to
    // this same shared dev DB concurrently, so the total can legitimately
    // grow between the two snapshots. Just confirm clearing the search
    // restores *some* rows.
    await page.locator('input[name="search"]').fill("");
    await expect(rows.first()).toBeVisible();
  });

  test("the 4 filter/sort selects render and can be changed", async ({ page, request }) => {
    await seedPayment(request);

    await page.goto("/admin/payments");
    const selects = page.locator("table").locator("xpath=preceding::select");
    // Status, Agent, Date Range, Sort By — 4 selects above the table.
    await expect(selects).toHaveCount(4);

    const [statusSelect, , dateSelect, sortSelect] = await selects.all();
    await statusSelect.selectOption("mock");
    await expect(statusSelect).toHaveValue("mock");

    await dateSelect.selectOption("today");
    await expect(dateSelect).toHaveValue("today");

    await sortSelect.selectOption("amount-desc");
    await expect(sortSelect).toHaveValue("amount-desc");

    await statusSelect.selectOption("all");
    await dateSelect.selectOption("all");
    await sortSelect.selectOption("date-desc");
  });

  test("Settle button on a paid, pending-settlement payment calls PATCH settle", async ({ page, request }) => {
    const { bookingId } = await seedPayment(request);
    // The mock order->verify flow leaves the payment in status "mock" (no
    // Razorpay keys configured for this test env) — flip it to "paid" in the
    // disposable test DB so the Settle button (status==="paid" gated) renders.
    forcePaymentPaidByBookingId(bookingId);

    await page.goto("/admin/payments");
    await page.locator("select").first().selectOption("paid");

    const settleBtn = page.getByRole("button", { name: /Settle/i }).first();
    await expect(settleBtn).toBeVisible({ timeout: 10_000 });

    const respPromise = page.waitForResponse(
      (r) => /\/admin\/payments\/.+\/settle$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await settleBtn.click();
    const resp = await respPromise;
    expect(resp.ok()).toBeTruthy();
  });

  test("Refund button on a paid payment calls PATCH refund and flips the row to Refunded", async ({ page, request }) => {
    const { bookingId } = await seedPayment(request);
    forcePaymentPaidByBookingId(bookingId);

    await page.goto("/admin/payments");
    await page.locator("select").first().selectOption("paid");

    const refundBtn = page.getByRole("button", { name: /Refund/i }).first();
    await expect(refundBtn).toBeVisible({ timeout: 10_000 });

    const respPromise = page.waitForResponse(
      (r) => /\/admin\/payments\/.+\/refund$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await refundBtn.click();
    const resp = await respPromise;
    expect(resp.ok()).toBeTruthy();

    // After a refund, the row's status badge should flip to "Refunded" and action buttons disappear.
    await expect(page.getByText("Refunded").first()).toBeVisible();
  });
});

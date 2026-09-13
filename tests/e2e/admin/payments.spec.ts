import { test, expect, type APIRequestContext } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { authHeader, ADMIN_EMAIL, ADMIN_PASSWORD } from "../../fixtures/api-client";
import { apiUrl, forcePaymentPaidByBookingId, seedPayment } from "../../fixtures/admin-e2e-ops-helpers";

// This project's `request` fixture is bound to the frontend origin, so backend
// calls go through the absolute apiUrl() helper — same as the sibling specs.
async function loginAsAdminApi(request: APIRequestContext) {
  const res = await request.post(apiUrl("/auth/admin-login"), {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) throw new Error(`admin-login failed: ${await res.text()}`);
  return { token: (await res.json()).data.token as string };
}

test.describe("Admin Payments", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
  });

  test("loads the payments list and stat tiles", async ({ page, request }) => {
    await seedPayment(request);

    await page.goto("/admin/payments");
    await expect(page.locator("h1")).toHaveText("Payments & Settlement");
    await expect(page.getByText("Gross collections")).toBeVisible();
    await expect(page.getByText("Refunds processed")).toBeVisible();
    await expect(page.getByText("Agent payouts settled")).toBeVisible();
    await expect(page.getByText("Pending settlement")).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("Export Excel asks for a date range, then downloads an .xlsx workbook", async ({ page, request }) => {
    await seedPayment(request);

    await page.goto("/admin/payments");
    await expect(page.locator("table tbody tr").first()).toBeVisible();

    await page.getByRole("button", { name: /Export Excel/i }).click();
    await expect(page.getByText("Export Payments")).toBeVisible();

    // Leaving both dates blank exports everything currently matching the
    // page's own filters — the simplest, most common case.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^nexclean-payments-.+\.xlsx$/);
  });

  test("Export Excel rejects a 'from' date after the 'to' date", async ({ page, request }) => {
    await seedPayment(request);

    await page.goto("/admin/payments");
    await page.getByRole("button", { name: /Export Excel/i }).click();

    await page.locator('input[type="date"]').first().fill("2025-06-15");
    await page.locator('input[type="date"]').nth(1).fill("2025-06-01");
    await page.getByRole("button", { name: "Export", exact: true }).click();

    await expect(page.getByText("must be on or before")).toBeVisible();
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

  test("Refund button opens the payment detail modal, and processing it calls PATCH refund with remarks", async ({
    page,
    request,
  }) => {
    const { bookingId } = await seedPayment(request);
    forcePaymentPaidByBookingId(bookingId);

    await page.goto("/admin/payments");
    await page.locator("select").first().selectOption("paid");

    // Refunds now go through the detail modal rather than firing blind, so a
    // remark can always be captured against the ledger entry.
    const refundBtn = page.getByRole("button", { name: /Refund/i }).first();
    await expect(refundBtn).toBeVisible({ timeout: 10_000 });
    await refundBtn.click();

    await expect(page.getByText("Process a refund")).toBeVisible();
    await page.getByPlaceholder(/Booking cancelled by admin/).fill("Customer requested refund — duplicate charge");

    const respPromise = page.waitForResponse(
      (r) => /\/admin\/payments\/.+\/refund$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: /Process refund/i }).click();
    const resp = await respPromise;
    expect(resp.ok()).toBeTruthy();

    // The modal re-resolves against the live (now-refunded) payment, so the
    // refund form gives way to the read-only refund summary in place.
    // PaymentDetailModal isn't role="dialog", and the same modal also shows a
    // "Refunded" status pill (a <span>) above this summary, plus the table
    // row behind it and the filter's <select> option — so scope to the
    // summary's own <p> tag rather than matching by text alone.
    await expect(page.locator("p").filter({ hasText: /^Refunded$/ })).toBeVisible();
  });

  /**
   * The Agent filter used to build its options from the payment rows on screen,
   * so a cleaner only showed up once they already had a payment in the list —
   * newly added agents, and anyone whose payments fell outside the 200-row
   * window the API returns, were missing from the filter entirely. Options now
   * come from the agents directory, so every agent is selectable.
   */
  test("the agent filter lists every agent, not just those with payments", async ({ page, request }) => {
    await seedPayment(request);

    const { token } = await loginAsAdminApi(request);
    const agents = (await (
      await request.get(apiUrl("/admin/agents"), { headers: authHeader(token) })
    ).json()).data as Array<{ id: string; name: string }>;
    expect(agents.length, "no agents seeded — the assertion below would be vacuous").toBeGreaterThan(0);

    await page.goto("/admin/payments");
    const agentSelect = page.locator("select").nth(1);
    await expect(agentSelect).toBeVisible();

    // Polled rather than read once: the options come from the agents query, so
    // a single synchronous read can land on the first paint when the only
    // option is "all" — which failed this test intermittently for reasons that
    // had nothing to do with the filter being correct.
    //
    // getAttribute keeps the callback on Element, so it needs no DOM lib types.
    await expect
      .poll(
        async () =>
          agentSelect.locator("option").evaluateAll((opts) => opts.map((o) => o.getAttribute("value"))),
        { message: "the agent options never loaded" },
      )
      .toEqual(expect.arrayContaining(agents.map((a) => a.id)));
  });

  /**
   * Asserts the selection is actually applied, without assuming anything about
   * which agents happen to have payments — earlier specs in a full run assign
   * agents to bookings, so "pick the first agent and expect an empty table"
   * holds in isolation and fails in the suite. seedPayment always creates an
   * *unassigned* booking, which is the one fact that stays true either way.
   */
  test("selecting an agent actually applies the filter", async ({ page, request }) => {
    await seedPayment(request);

    const { token } = await loginAsAdminApi(request);
    const agents = (await (
      await request.get(apiUrl("/admin/agents"), { headers: authHeader(token) })
    ).json()).data as Array<{ id: string; name: string }>;

    await page.goto("/admin/payments");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();

    // Unassigned: every row on screen must have an empty agent cell.
    await page.locator("select").nth(1).selectOption("unassigned");
    await expect(rows.first()).toBeVisible();
    const unassignedAgents = await rows.locator("td:nth-child(3)").allTextContents();
    expect(unassignedAgents.length).toBeGreaterThan(0);
    for (const cell of unassignedAgents) expect(cell.trim()).toBe("—");

    // A named agent: nothing unassigned may leak through, and any row that does
    // show must belong to that agent.
    await page.locator("select").nth(1).selectOption(agents[0].id);
    const noMatches = await page.getByText("No payments match your search.").isVisible().catch(() => false);
    if (!noMatches) {
      const named = await rows.locator("td:nth-child(3)").allTextContents();
      for (const cell of named) expect(cell.trim()).toBe(agents[0].name);
    }
  });
});

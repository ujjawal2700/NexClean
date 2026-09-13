import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { authHeader, DEMO_OTP, uniqueName } from "../../fixtures/api-client";
import { seedNamedCustomer, loginAsNewCustomerApi, withRetry, apiUrl } from "../../fixtures/admin-e2e-ops-helpers";

test.describe("Admin Customers", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
  });

  test("lists customers, and search filters them down", async ({ page, request }) => {
    const name = uniqueName("Search Test Customer");
    await seedNamedCustomer(request, name);

    await page.goto("/admin/customers");
    await expect(page.locator("h1")).toHaveText("Customers");

    await page.locator('input[name="search"]').fill(name);
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.locator("table tbody tr")).toHaveCount(1);

    await page.locator('input[name="search"]').fill("zzz-no-such-customer-zzz");
    await expect(page.getByText("No customers match your filters.")).toBeVisible();
  });

  test("Export Excel asks for a date range, then downloads an .xlsx workbook", async ({ page, request }) => {
    const name = uniqueName("Export Test Customer");
    await seedNamedCustomer(request, name);

    await page.goto("/admin/customers");
    await page.locator('input[name="search"]').fill(name);
    await expect(page.locator("table tbody tr")).toHaveCount(1);

    await page.getByRole("button", { name: /Export Excel/i }).click();
    await expect(page.getByText("Export Customers")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^nexclean-customers-.+\.xlsx$/);
  });

  test("status filter pills narrow the table", async ({ page, request }) => {
    // The shared dev DB is under heavy concurrent write load from sibling
    // agents' suites (hundreds of rows can appear mid-test), so comparing
    // aggregate row counts before/after a filter click is inherently flaky.
    // Instead: seed one known active customer, scope the table to it via
    // search, and confirm the status pills correctly show/hide that one row.
    const name = uniqueName("Filter Pills Customer");
    await seedNamedCustomer(request, name);

    await page.goto("/admin/customers");
    await page.locator('input[name="search"]').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    // There are two "All" pill groups (Status and Plan) — scope to the pill
    // row immediately following the "Status" label.
    const statusGroup = page.locator("p", { hasText: "Status" }).locator("xpath=following-sibling::div[1]");

    await statusGroup.getByRole("button", { name: "Active" }).click();
    await expect(page.getByText(name)).toBeVisible();

    await statusGroup.getByRole("button", { name: "Suspended" }).click();
    await expect(page.getByText(name)).not.toBeVisible();
    await expect(page.getByText("No customers match your filters.")).toBeVisible();

    await statusGroup.getByRole("button", { name: "All" }).click();
    await expect(page.getByText(name)).toBeVisible();
  });

  test("row click navigates to the customer detail page", async ({ page, request }) => {
    const name = uniqueName("RowClick Customer");
    await seedNamedCustomer(request, name);

    await page.goto("/admin/customers");
    await page.locator('input[name="search"]').fill(name);
    await page.getByText(name).click();

    await expect(page).toHaveURL(/\/admin\/customers\/[^/]+$/);
    await expect(page.locator("h1")).toHaveText(name);
  });

  test("customer detail: suspend, then verify the same phone is rejected at login (403), then reactivate", async ({
    page,
    request,
  }) => {
    const name = uniqueName("Suspend Customer");
    const { phone } = await seedNamedCustomer(request, name);

    await page.goto("/admin/customers");
    await page.locator('input[name="search"]').fill(name);
    await page.getByText(name).click();
    await expect(page.locator("h1")).toHaveText(name);

    const suspendBtn = page.getByRole("button", { name: /Suspend/i });
    await expect(suspendBtn).toBeVisible();
    const suspendRespPromise = page.waitForResponse(
      (r) => /\/admin\/customers\/.+\/status$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await suspendBtn.click();
    expect((await suspendRespPromise).ok()).toBeTruthy();
    await expect(page.getByRole("button", { name: /Reactivate/i })).toBeVisible();

    // Cross-cutting regression check: a suspended customer can no longer log in.
    await request.post(apiUrl("/auth/send-otp"), { data: { phone } });
    const verify = await request.post(apiUrl("/auth/verify-otp"), { data: { phone, code: DEMO_OTP } });
    expect(verify.status()).toBe(403);

    const reactivateBtn = page.getByRole("button", { name: /Reactivate/i });
    const reactivateRespPromise = page.waitForResponse(
      (r) => /\/admin\/customers\/.+\/status$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await reactivateBtn.click();
    expect((await reactivateRespPromise).ok()).toBeTruthy();
    await expect(page.getByRole("button", { name: /Suspend/i })).toBeVisible();
  });

  test("download-receipt buttons don't throw a console error", async ({ page, request }) => {
    // Need a customer with at least one booking so a receipt row/button exists.
    // Wrapped in a retry: other agents run their own e2e suites concurrently
    // against this same local backend, which can occasionally truncate a
    // response mid-flight under combined load.
    const { userId } = await withRetry(async () => {
      const { token: customerToken, userId: uid } = await loginAsNewCustomerApi(request);
      const pkgRes = await request.get(apiUrl("/catalog/packages"));
      const packageId = (await pkgRes.json()).data[0].id;
      const bookingRes = await request.post(apiUrl("/bookings"), {
        headers: authHeader(customerToken),
        data: {
          vehicleType: "hatchback",
          vehicleName: "Test Car",
          packageId,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          slot: "11:00 AM",
          addressLabel: "Home",
          addressLine: "123 Test Street",
        },
      });
      if (!bookingRes.ok()) throw new Error(`booking seed failed: ${await bookingRes.text()}`);
      return { userId: uid };
    });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await page.goto(`/admin/customers/${userId}`);
    const downloadBtn = page.locator('button[aria-label^="Download receipt for booking"]').first();
    await expect(downloadBtn).toBeVisible();
    await downloadBtn.click();
    await page.waitForTimeout(500);

    expect(consoleErrors, `Console errors during receipt download: ${consoleErrors.join("\n")}`).toHaveLength(0);
  });
});

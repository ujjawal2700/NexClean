import { test, expect, request as pwRequest } from "@playwright/test";
import { apiUrl, authHeader, loginAsAdmin, loginAsNewCustomer } from "../../fixtures/api-client";
import { loginAdminUI } from "../../fixtures/ui-helpers";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

test.describe("Admin bookkeeping", () => {
  let original: Json;

  test.beforeAll(async () => {
    const api = await pwRequest.newContext();
    const { token } = await loginAsAdmin(api);
    original = (await (await api.get(apiUrl("/admin/bookkeeping/config"), { headers: authHeader(token) })).json()).data;
    await api.dispose();
  });

  test.afterEach(async () => {
    const api = await pwRequest.newContext();
    const { token } = await loginAsAdmin(api);
    await api.put(apiUrl("/admin/bookkeeping/config"), {
      headers: authHeader(token),
      data: { tax: original.tax, business: original.business, invoice: original.invoice, template: original.template },
    });
    await api.dispose();
  });

  test("overview shows the period's figures and the sidebar section", async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/bookkeeping");
    await expect(page.locator("h1")).toHaveText("Bookkeeping");
    await expect(page.getByTestId("stat-billed")).toBeVisible();
    await expect(page.getByTestId("stat-gst")).toBeVisible();
    await expect(page.getByTestId("price-flow")).toContainText("Taxable value");
    await page.getByRole("button", { name: "This financial year" }).click();
    await expect(page.getByTestId("stat-billed")).toBeVisible();
  });

  test("GST settings: turn GST on at 12% with IGST, see the worked example, save", async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/bookkeeping/settings");
    const gst = page.getByTestId("gst-settings");
    const toggle = gst.getByRole("switch", { name: "Apply GST at checkout" });
    if (!(await toggle.isChecked())) await page.locator("label", { has: page.getByRole("switch", { name: "Apply GST at checkout" }) }).click();
    await expect(toggle).toBeChecked();
    await gst.getByRole("button", { name: "12%" }).click();
    await gst.getByRole("button", { name: /Other state/ }).click();
    await expect(page.getByTestId("gst-example")).toContainText("IGST @ 12%");
    await expect(page.getByTestId("gst-example")).toContainText("₹1,120.00");
    await page.getByTestId("save-bookkeeping").click();
    await expect(page.getByText("Saved")).toBeVisible();

    const pub = await (await pwRequest.newContext()).get(apiUrl("/catalog/tax"));
    expect((await pub.json()).data).toMatchObject({ enabled: true, rate: 12, supplyType: "inter" });
  });

  test("invoice template: edits show in the live preview and persist after saving", async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/bookkeeping/template");
    const preview = page.getByTestId("template-preview");
    await page.locator('input[name="title"]').fill("Service Invoice");
    await expect(preview).toContainText("Service Invoice");
    await page.locator('input[name="label-total"]').fill("Amount due");
    await expect(preview).toContainText("Amount due");
    await page.getByLabel("Signature block").uncheck();
    await expect(preview).not.toContainText("Authorised Signatory");
    await page.getByTestId("save-template").click();
    await expect(page.getByText("Saved")).toBeVisible();

    await page.reload();
    await expect(page.locator('input[name="title"]')).toHaveValue("Service Invoice");
    await expect(page.getByTestId("template-preview")).toContainText("Amount due");
  });

  test("invoices: find one, open it, correct the bill-to name and see it on the document", async ({ page }) => {
    // A fresh booking → a fresh invoice.
    const api = await pwRequest.newContext();
    const { token } = await loginAsNewCustomer(api);
    const pkg = (await (await api.get(apiUrl("/catalog/packages"))).json()).data[0].id;
    const created = await api.post(apiUrl("/bookings"), {
      headers: authHeader(token),
      data: {
        vehicleType: "hatchback",
        vehicleName: "Invoice UI Car",
        packageId: pkg,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        slot: "11:00 AM",
        addressLabel: "Home",
        addressLine: "3 Ledger Lane",
      },
    });
    const bookingId = (await created.json()).data.id;
    let number = "";
    for (let i = 0; i < 20 && !number; i++) {
      const res = await api.get(apiUrl(`/bookings/${bookingId}/invoice`), { headers: authHeader(token) });
      if (res.ok()) number = (await res.json()).data.invoice.invoiceNumber;
      else await new Promise((r) => setTimeout(r, 150));
    }
    await api.dispose();

    await loginAdminUI(page);
    await page.goto("/admin/bookkeeping/invoices");
    await page.getByLabel("Search invoices").fill(number);
    const row = page.getByTestId("invoice-row");
    await expect(row).toHaveCount(1);
    await row.getByRole("link", { name: number }).click();

    await expect(page.locator("h1")).toHaveText(number);
    await page.getByTestId("edit-invoice").click();
    await page.locator('input[name="billName"]').fill("Acme Fleet Pvt Ltd");
    await expect(page.getByTestId("invoice-document")).toContainText("Acme Fleet Pvt Ltd");
    await page.getByTestId("save-invoice").click();
    await expect(page.getByTestId("edit-invoice")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("invoice-document")).toContainText("Acme Fleet Pvt Ltd");
    await expect(page.getByText(/edited 1×/)).toBeVisible();

    // The booking page links to the same invoice.
    await page.goto(`/admin/bookings/${bookingId}`);
    await expect(page.getByTestId("booking-invoice-number")).toHaveText(number);
  });
});

import { test, expect } from "@playwright/test";
import { apiUrl, authHeader, freshPhone, loginAsAdmin } from "../../fixtures/api-client";
import { loginCustomerUI } from "../../fixtures/ui-helpers";
import { apiContext, mintTokenForPhone, seedVehicleAndAddress } from "../../fixtures/customer-e2e-helpers";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

test.describe("GST at checkout and the customer invoice", () => {
  let originalTax: Json;

  test.beforeAll(async () => {
    const api = await apiContext();
    const { token } = await loginAsAdmin(api);
    originalTax = (await (await api.get(apiUrl("/admin/bookkeeping/config"), { headers: authHeader(token) })).json()).data.tax;
    await api.put(apiUrl("/admin/bookkeeping/config"), {
      headers: authHeader(token),
      data: { tax: { enabled: true, rate: 18, supplyType: "intra", label: "GST" } },
    });
    await api.dispose();
  });

  test.afterAll(async () => {
    const api = await apiContext();
    const { token } = await loginAsAdmin(api);
    await api.put(apiUrl("/admin/bookkeeping/config"), { headers: authHeader(token), data: { tax: originalTax } });
    await api.dispose();
  });

  test("checkout adds GST on top; the booking shows the breakdown; the invoice can be viewed and downloaded", async ({ page }) => {
    test.setTimeout(90_000);
    const phone = freshPhone();
    const api = await apiContext();
    const { token } = await mintTokenForPhone(api, phone);
    await seedVehicleAndAddress(api, token, {
      vehicleType: "hatchback",
      vehicleName: "GST Hatchback",
      addressLabel: "Home",
      addressLine: "12 Tax Street, Indore",
    });
    await api.dispose();

    await loginCustomerUI(page, phone);
    await page.goto("/app/book");
    await page.getByRole("button", { name: /GST Hatchback/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Express Wash/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).nth(1).click();
    await page.getByRole("button", { name: /^\d{2}:\d{2} (AM|PM)$/ }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Home/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Payment step: GST line, and the total includes it.
    const taxRow = page.getByTestId("checkout-tax");
    await expect(taxRow).toContainText("GST (18%)");
    const total = (await page.getByTestId("checkout-total-amount").innerText()).trim();
    const payButton = page.getByRole("button", { name: /^Pay ₹/ });
    await expect(payButton).toHaveText(`Pay ${total}`);
    await payButton.click();
    await expect(page.locator("h1")).toHaveText("Booking confirmed!", { timeout: 15000 });
    await page.waitForURL(/\/app\/track\/[a-f0-9]{24}$/, { timeout: 15000 });
    const bookingId = page.url().split("/").pop()!;

    // Booking detail: CGST + SGST and the same total.
    await page.goto(`/app/bookings/${bookingId}`);
    const breakdown = page.getByTestId("price-breakdown");
    await expect(breakdown).toContainText("CGST @ 9%");
    await expect(breakdown).toContainText("SGST @ 9%");
    await expect(page.getByTestId("booking-total")).toHaveText(total);

    // Invoice page.
    await page.getByTestId("view-invoice").click();
    await expect(page).toHaveURL(new RegExp(`/app/bookings/${bookingId}/invoice$`));
    const doc = page.getByTestId("invoice-document");
    await expect(doc.getByTestId("invoice-number")).toHaveText(/\/\d{4}-\d{2}\/\d+$/);
    await expect(doc).toContainText("CGST @ 9%");
    await expect(doc.getByTestId("invoice-status")).toHaveText("Unpaid");
    // ₹1,180.00 on the invoice ↔ ₹1,180 at checkout.
    const invoiceTotal = (await doc.getByTestId("invoice-total").innerText()).replace(/\.00$/, "");
    expect(invoiceTotal).toBe(total);

    // PDF download.
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("invoice-download").click()]);
    expect(download.suggestedFilename()).toMatch(/^invoice-.+\.pdf$/);
    const path = await download.path();
    const fs = await import("node:fs");
    const head = fs.readFileSync(path!).subarray(0, 5).toString();
    expect(head).toBe("%PDF-");
  });
});

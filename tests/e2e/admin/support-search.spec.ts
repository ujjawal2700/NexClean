import { test, expect } from "@playwright/test";
import { API_BASE_URL } from "../../playwright.config";
import { LEGAL_ACCEPTANCE, freshPhone } from "../../fixtures/api-client";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test("admin can search support conversations, across open and closed", async ({ page }) => {
  const name = `Searchable ${Date.now().toString(36)}`.replace(/\d/g, "x");
  const phone = freshPhone();
  await page.request.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name, phone, ...LEGAL_ACCEPTANCE } });
  const token = (await (await page.request.post(`${API_BASE_URL}/auth/verify-otp`, { data: { phone, code: "123456" } })).json()).data.token;
  const h = { Authorization: `Bearer ${token}` };
  const ticket = (await (await page.request.post(`${API_BASE_URL}/chat/tickets`, { headers: h, data: { topic: "app" } })).json()).data;
  await page.request.post(`${API_BASE_URL}/chat/tickets/${ticket.id}/messages`, { headers: h, data: { text: "Help" } });

  await loginAdminUI(page);
  await page.goto("/admin/support");
  const search = page.getByRole("searchbox", { name: "Search conversations" });
  await search.fill(name);
  await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  await search.fill(phone);
  await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  await search.fill("no-such-person-zzz");
  await expect(page.getByText(/No open conversations match/)).toBeVisible();

  // Closed conversations are found too, via a one-tap switch.
  await page.request.patch(`${API_BASE_URL}/chat/tickets/${ticket.id}/close`, { headers: h });
  await page.reload();
  await page.getByRole("searchbox", { name: "Search conversations" }).fill(name);
  await page.getByRole("button", { name: /match in closed — show/ }).click();
  await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
});

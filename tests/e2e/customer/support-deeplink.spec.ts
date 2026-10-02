import { test, expect } from "@playwright/test";
import { API_BASE_URL } from "../../playwright.config";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

// Tapping a "Support replied" notification opens /app/help?ticket=<id>, which
// must land straight in that conversation.
test("a ?ticket= link opens that support conversation directly", async ({ page }) => {
  const phone = await loginCustomerUI(page);
  const token = (await (await page.request.post(`${API_BASE_URL}/auth/verify-otp`, { data: { phone, code: "123456" } })).json()).data.token;
  const h = { Authorization: `Bearer ${token}` };
  const ticket = (await (await page.request.post(`${API_BASE_URL}/chat/tickets`, { headers: h, data: { topic: "account" } })).json()).data;
  await page.request.post(`${API_BASE_URL}/chat/tickets/${ticket.id}/messages`, { headers: h, data: { text: "Can't change my email" } });

  await page.goto(`/app/help?ticket=${ticket.id}`);
  await expect(page.getByText("Can't change my email")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();

  // Back goes to the hub and doesn't bounce into the chat again.
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Your conversations" })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/help$/);
});

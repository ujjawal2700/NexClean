import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, authHeader } from "../../fixtures/api-client";
import { apiUrl } from "../../fixtures/admin-e2e-ops-helpers";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { WEB_BASE_URL } from "../../playwright.config";

test("internal messages deliver live and show an unread badge with staff identity", async ({ page, browser, request }) => {
  const adminLogin = await request.post(apiUrl("/auth/admin-login"), {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const superToken = (await adminLogin.json()).data.token as string;
  const stamp = Date.now();
  const roleName = `Realtime Supervisor ${stamp}`;
  const staffName = "Realtime Supervisor";
  const staffEmail = `realtime-supervisor-${stamp}@example.com`;
  const staffPassword = "Passw0rd!23";

  const roleResponse = await request.post(apiUrl("/admin/roles"), {
    headers: authHeader(superToken),
    data: { name: roleName, permissions: ["dashboard"] },
  });
  const role = (await roleResponse.json()).data;
  const staffResponse = await request.post(apiUrl("/admin/staff"), {
    headers: authHeader(superToken),
    data: { name: staffName, email: staffEmail, password: staffPassword, adminRoleId: role.id },
  });
  const staff = (await staffResponse.json()).data;
  const staffContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const staffPage = await staffContext.newPage();

  try {
    await staffPage.goto(`${WEB_BASE_URL}/admin/login`);
    await staffPage.locator('input[name="email"]').fill(staffEmail);
    await staffPage.locator('input[name="password"]').fill(staffPassword);
    await staffPage.getByRole("button", { name: "Sign in" }).click();
    await expect(staffPage).toHaveURL(/\/admin$/);
    await expect(staffPage.getByRole("link", { name: /Internal Messages/ })).toBeVisible();

    await loginAdminUI(page);
    await page.goto("/admin/internal-messages");
    await page.getByRole("button", { name: new RegExp(staffName) }).click();
    await expect(page.getByText(roleName, { exact: true }).last()).toBeVisible();

    const text = `Realtime handoff ${stamp}`;
    await page.getByPlaceholder(`Message ${staffName}`).fill(text);
    const sendButton = page.getByRole("button", { name: "Send message" });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    const staffNav = staffPage.getByRole("link", { name: /Internal Messages/ });
    await expect(staffNav).toContainText("1", { timeout: 10_000 });
    await staffNav.click();
    await staffPage.getByText("Super Admin", { exact: true }).locator("xpath=ancestor::button").click();
    await expect(staffPage.getByTestId("internal-message-text").filter({ hasText: text })).toBeVisible();
    await expect(staffPage.getByText("Super Admin", { exact: true }).last()).toBeVisible();
  } finally {
    await request.delete(apiUrl(`/admin/staff/${staff.id}`), { headers: authHeader(superToken) });
    await request.delete(apiUrl(`/admin/roles/${role.id}`), { headers: authHeader(superToken) });
    await staffContext.close().catch(() => {});
  }
});

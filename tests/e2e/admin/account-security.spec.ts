import { test, expect, type APIRequestContext } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_OTP, authHeader } from "../../fixtures/api-client";
import { apiUrl } from "../../fixtures/admin-e2e-ops-helpers";
import { loginAdminUI } from "../../fixtures/ui-helpers";

async function createStaff(request: APIRequestContext, suffix: string) {
  const adminLogin = await request.post(apiUrl("/auth/admin-login"), {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const superToken = (await adminLogin.json()).data.token as string;
  const roleResponse = await request.post(apiUrl("/admin/roles"), {
    headers: authHeader(superToken),
    data: { name: `UI Account Security ${suffix}`, permissions: ["dashboard"] },
  });
  const role = (await roleResponse.json()).data;
  const email = `ui-account-${suffix}@example.com`;
  const password = "Original1Pass";
  const staffResponse = await request.post(apiUrl("/admin/staff"), {
    headers: authHeader(superToken),
    data: { name: "UI Security Admin", email, password, adminRoleId: role.id },
  });
  const staff = (await staffResponse.json()).data;
  return { superToken, role, staff, email, password };
}

test("admin profile changes login email and password with security confirmation", async ({ page, request }) => {
  const created = await createStaff(request, `${Date.now()}-change`);
  const newEmail = `ui-changed-${Date.now()}@example.com`;
  const newPassword = "Updated2Password";
  try {
    await loginAdminUI(page, created.email, created.password);
    await page.goto("/admin/profile");
    await expect(page.getByRole("heading", { name: "Account & Security" })).toBeVisible();

    await page.locator('input[name="adminEmail"]').fill(newEmail);
    await page.locator('input[name="emailCurrentPassword"]').fill(created.password);
    await page.getByRole("button", { name: "Update login email" }).click();
    await expect(page.getByText(/Login email updated/)).toBeVisible();

    await page.locator('input[name="currentPassword"]').fill(created.password);
    await page.locator('input[name="newPassword"]').fill(newPassword);
    await page.locator('input[name="confirmPassword"]').fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByText(/Password updated/)).toBeVisible();

    await page.locator('input[name="email"]').fill(newEmail);
    await page.locator('input[name="password"]').fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  } finally {
    await request.delete(apiUrl(`/admin/staff/${created.staff.id}`), { headers: authHeader(created.superToken) });
    await request.delete(apiUrl(`/admin/roles/${created.role.id}`), { headers: authHeader(created.superToken) });
  }
});

test("forgot password resets an admin credential from the login screen", async ({ page, request }) => {
  const created = await createStaff(request, `${Date.now()}-reset`);
  const newPassword = "Recovered3Password";
  try {
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset admin password" })).toBeVisible();
    await page.locator('input[name="email"]').fill(created.email);
    await page.getByRole("button", { name: "Send reset code" }).click();
    await expect(page.getByText(/6-digit reset code has been sent/)).toBeVisible();

    await page.locator('input[name="resetCode"]').fill(DEMO_OTP);
    await page.locator('input[name="newPassword"]').fill(newPassword);
    await page.locator('input[name="confirmPassword"]').fill(newPassword);
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText(/Password reset successfully/)).toBeVisible();

    await page.locator('input[name="password"]').fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  } finally {
    await request.delete(apiUrl(`/admin/staff/${created.staff.id}`), { headers: authHeader(created.superToken) });
    await request.delete(apiUrl(`/admin/roles/${created.role.id}`), { headers: authHeader(created.superToken) });
  }
});

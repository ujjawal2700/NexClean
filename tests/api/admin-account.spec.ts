import { test, expect, type APIRequestContext } from "@playwright/test";
import { DEMO_OTP, authHeader } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi } from "../fixtures/admin-api-helpers";

async function createStaff(request: APIRequestContext, superToken: string, suffix: string) {
  const roleResponse = await request.post(apiUrl("/admin/roles"), {
    headers: authHeader(superToken),
    data: { name: `Account Security ${suffix}`, permissions: ["dashboard"] },
  });
  expect(roleResponse.status()).toBe(201);
  const role = (await roleResponse.json()).data;
  const email = `account-${suffix}@example.com`;
  const password = "Original1Pass";
  const staffResponse = await request.post(apiUrl("/admin/staff"), {
    headers: authHeader(superToken),
    data: { name: "Account Security Admin", email, password, adminRoleId: role.id },
  });
  expect(staffResponse.status()).toBe(201);
  return { role, staff: (await staffResponse.json()).data, email, password };
}

async function login(request: APIRequestContext, email: string, password: string) {
  return request.post(apiUrl("/auth/admin-login"), { data: { email, password } });
}

test.describe("Admin account security", () => {
  test("an admin can change their login email only after confirming the current password", async ({ request }) => {
    const { token: superToken } = await loginAsAdminApi(request);
    const created = await createStaff(request, superToken, `${Date.now()}-email`);
    const newEmail = `changed-${Date.now()}@example.com`;

    try {
      const staffLogin = await login(request, created.email, created.password);
      const staffToken = (await staffLogin.json()).data.token as string;

      const wrongPassword = await request.patch(apiUrl("/admin/account/email"), {
        headers: authHeader(staffToken),
        data: { email: newEmail, currentPassword: "Wrong1Password" },
      });
      expect(wrongPassword.status()).toBe(401);

      const changed = await request.patch(apiUrl("/admin/account/email"), {
        headers: authHeader(staffToken),
        data: { email: newEmail, currentPassword: created.password },
      });
      expect(changed.ok()).toBeTruthy();
      expect((await changed.json()).data.email).toBe(newEmail);

      expect((await login(request, created.email, created.password)).status()).toBe(401);
      expect((await login(request, newEmail, created.password)).ok()).toBeTruthy();
    } finally {
      await request.delete(apiUrl(`/admin/staff/${created.staff.id}`), { headers: authHeader(superToken) });
      await request.delete(apiUrl(`/admin/roles/${created.role.id}`), { headers: authHeader(superToken) });
    }
  });

  test("changing an admin password revokes existing sessions and replaces the old credential", async ({ request }) => {
    const { token: superToken } = await loginAsAdminApi(request);
    const created = await createStaff(request, superToken, `${Date.now()}-password`);
    const newPassword = "Updated2Password";

    try {
      const staffLogin = await login(request, created.email, created.password);
      const staffToken = (await staffLogin.json()).data.token as string;

      const weak = await request.patch(apiUrl("/admin/account/password"), {
        headers: authHeader(staffToken),
        data: { currentPassword: created.password, newPassword: "short" },
      });
      expect(weak.status()).toBe(400);

      const changed = await request.patch(apiUrl("/admin/account/password"), {
        headers: authHeader(staffToken),
        data: { currentPassword: created.password, newPassword },
      });
      expect(changed.ok()).toBeTruthy();

      expect((await request.get(apiUrl("/auth/me"), { headers: authHeader(staffToken) })).status()).toBe(401);
      expect((await login(request, created.email, created.password)).status()).toBe(401);
      expect((await login(request, created.email, newPassword)).ok()).toBeTruthy();
    } finally {
      await request.delete(apiUrl(`/admin/staff/${created.staff.id}`), { headers: authHeader(superToken) });
      await request.delete(apiUrl(`/admin/roles/${created.role.id}`), { headers: authHeader(superToken) });
    }
  });

  test("forgot-password uses an email code, hides account existence, and resets the credential", async ({ request }) => {
    const { token: superToken } = await loginAsAdminApi(request);
    const created = await createStaff(request, superToken, `${Date.now()}-reset`);
    const newPassword = "Recovered3Password";

    try {
      const unknown = await request.post(apiUrl("/auth/admin-password-reset/request"), {
        data: { email: `missing-${Date.now()}@example.com` },
      });
      expect(unknown.ok()).toBeTruthy();
      expect((await unknown.json()).message).toContain("If an active admin account exists");

      const requested = await request.post(apiUrl("/auth/admin-password-reset/request"), {
        data: { email: created.email },
      });
      expect(requested.ok()).toBeTruthy();

      const wrong = await request.post(apiUrl("/auth/admin-password-reset/confirm"), {
        data: { email: created.email, code: "000000", newPassword },
      });
      expect(wrong.status()).toBe(400);

      const reset = await request.post(apiUrl("/auth/admin-password-reset/confirm"), {
        data: { email: created.email, code: DEMO_OTP, newPassword },
      });
      expect(reset.ok()).toBeTruthy();
      expect((await login(request, created.email, created.password)).status()).toBe(401);
      expect((await login(request, created.email, newPassword)).ok()).toBeTruthy();
    } finally {
      await request.delete(apiUrl(`/admin/staff/${created.staff.id}`), { headers: authHeader(superToken) });
      await request.delete(apiUrl(`/admin/roles/${created.role.id}`), { headers: authHeader(superToken) });
    }
  });
});

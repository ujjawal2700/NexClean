import { test, expect } from "@playwright/test";
import { authHeader, ADMIN_EMAIL } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi } from "../fixtures/admin-api-helpers";

test.describe("Admin — content", () => {
  test("GET /admin/content requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/content"));
    expect(res.status()).toBe(401);
  });

  test("GET /admin/content returns the site content doc", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/content"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.footer).toBeTruthy();
    expect(body.data.landing).toBeTruthy();
  });

  test("PUT /admin/content accepts a minimal empty partial", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.put(apiUrl("/admin/content"), { headers: authHeader(token), data: {} });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).message).toBe("Content updated");
  });

  test("PUT /admin/content rejects a malformed nested section", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.put(apiUrl("/admin/content"), {
      headers: authHeader(token),
      data: { footer: { tagline: 123 } }, // tagline must be a string, columns missing entirely
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Invalid content");
  });
});

test.describe("Admin — referrals", () => {
  test("GET /admin/referral-config requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/referral-config"));
    expect(res.status()).toBe(401);
  });

  test("GET /admin/referral-config returns the global config", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/referral-config"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.data.referrerReward).toBe("number");
    expect(typeof body.data.active).toBe("boolean");
  });

  test("PUT /admin/referral-config rejects a negative reward", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.put(apiUrl("/admin/referral-config"), {
      headers: authHeader(token),
      data: { referrerReward: -5 },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Invalid referral config update");
  });

  test("PUT /admin/referral-config updates and restores maxRedeemPercent", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const before = await (await request.get(apiUrl("/admin/referral-config"), { headers: authHeader(token) })).json();
    const original = before.data.maxRedeemPercent;

    const updated = await request.put(apiUrl("/admin/referral-config"), {
      headers: authHeader(token),
      data: { maxRedeemPercent: 42 },
    });
    expect(updated.ok()).toBeTruthy();
    expect((await updated.json()).data.maxRedeemPercent).toBe(42);

    const restored = await request.put(apiUrl("/admin/referral-config"), {
      headers: authHeader(token),
      data: { maxRedeemPercent: original },
    });
    expect((await restored.json()).data.maxRedeemPercent).toBe(original);
  });

  test("GET /admin/referral-logs requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/referral-logs"));
    expect(res.status()).toBe(401);
  });

  test("GET /admin/referral-logs returns an array", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/referral-logs"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).data)).toBe(true);
  });
});

test.describe("Admin — roles & staff", () => {
  test("GET /admin/roles requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/roles"));
    expect(res.status()).toBe(401);
  });

  test("POST /admin/roles rejects a missing name", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/roles"), { headers: authHeader(token), data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Role name is required");
  });

  test("create → delete a role with no staff assigned", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const name = `Test Role ${Date.now()}`;

    const create = await request.post(apiUrl("/admin/roles"), {
      headers: authHeader(token),
      data: { name, permissions: ["dashboard", "bookings"] },
    });
    expect(create.status()).toBe(201);
    const role = (await create.json()).data;
    expect(role.name).toBe(name);

    const del = await request.delete(apiUrl(`/admin/roles/${role.id}`), { headers: authHeader(token) });
    expect(del.ok()).toBeTruthy();

    const list = await (await request.get(apiUrl("/admin/roles"), { headers: authHeader(token) })).json();
    expect(list.data.find((r: { id: string }) => r.id === role.id)).toBeUndefined();
  });

  test("GET /admin/staff requires admin auth", async ({ request }) => {
    const res = await request.get(apiUrl("/admin/staff"));
    expect(res.status()).toBe(401);
  });

  test("POST /admin/staff rejects missing fields", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/staff"), { headers: authHeader(token), data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Name, email, password, and role are required");
  });

  test("POST /admin/staff rejects the superadmin email", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const role = (
      await (await request.post(apiUrl("/admin/roles"), { headers: authHeader(token), data: { name: `Role ${Date.now()}` } })).json()
    ).data;

    const res = await request.post(apiUrl("/admin/staff"), {
      headers: authHeader(token),
      data: { name: "Someone", email: ADMIN_EMAIL, password: "password123", adminRoleId: role.id },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Cannot create staff user with superadmin email");

    await request.delete(apiUrl(`/admin/roles/${role.id}`), { headers: authHeader(token) });
  });

  test("full staff lifecycle: create → duplicate email rejected → update → delete; deleting an assigned role is blocked", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const roleName = `Test Role ${Date.now()}`;
    const role = (
      await (await request.post(apiUrl("/admin/roles"), { headers: authHeader(token), data: { name: roleName, permissions: ["dashboard"] } })).json()
    ).data;

    const email = `staff-${Date.now()}@example.com`;
    const create = await request.post(apiUrl("/admin/staff"), {
      headers: authHeader(token),
      data: { name: "Test Staff", email, password: "password123", adminRoleId: role.id },
    });
    expect(create.status()).toBe(201);
    const staff = (await create.json()).data;
    expect(staff.email).toBe(email);

    // Duplicate email.
    const dup = await request.post(apiUrl("/admin/staff"), {
      headers: authHeader(token),
      data: { name: "Someone Else", email, password: "password123", adminRoleId: role.id },
    });
    expect(dup.status()).toBe(400);
    expect((await dup.json()).message).toBe("A user with this email already exists");

    // Role is now assigned to a staff member — delete should be blocked.
    const delRoleBlocked = await request.delete(apiUrl(`/admin/roles/${role.id}`), { headers: authHeader(token) });
    expect(delRoleBlocked.status()).toBe(400);
    expect((await delRoleBlocked.json()).message).toBe("Cannot delete role as it is assigned to existing staff members");

    // Update.
    const update = await request.patch(apiUrl(`/admin/staff/${staff.id}`), {
      headers: authHeader(token),
      data: { name: "Updated Name", email, adminRoleId: role.id },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).data.name).toBe("Updated Name");

    // Delete the staff, then the role can be deleted.
    const delStaff = await request.delete(apiUrl(`/admin/staff/${staff.id}`), { headers: authHeader(token) });
    expect(delStaff.ok()).toBeTruthy();

    const delRole = await request.delete(apiUrl(`/admin/roles/${role.id}`), { headers: authHeader(token) });
    expect(delRole.ok()).toBeTruthy();
  });
});

test.describe("Admin — upload", () => {
  // Cloudinary isn't configured in this environment — only the validation path is testable.
  test("POST /admin/upload rejects an empty body", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/upload"), { headers: authHeader(token), data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Image base64 data is required");
  });
});

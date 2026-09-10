import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { authHeader, ADMIN_EMAIL, ADMIN_PASSWORD, SEED_AGENT_PHONE } from "../../fixtures/api-client";
import { seedPendingAgent, apiUrl } from "../../fixtures/admin-e2e-ops-helpers";

// The "admin-e2e" project's `request` fixture baseURL is the *frontend*
// (http://localhost:5173), not the backend API — so fixtures/api-client.ts's
// loginAsAdmin() (which posts to a bare "/auth/admin-login") silently misses
// the backend here. Log in against an explicit absolute backend URL instead
// (see the long comment in fixtures/admin-e2e-ops-helpers.ts for the full story).
async function loginAsAdminApi(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post(apiUrl("/auth/admin-login"), { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (!res.ok()) throw new Error(`admin-login failed: ${await res.text()}`);
  const body = await res.json();
  return { token: body.data.token as string };
}

async function findAgentIdByPhone(request: import("@playwright/test").APIRequestContext, adminToken: string, phone: string) {
  const res = await request.get(apiUrl("/admin/agents"), { headers: authHeader(adminToken) });
  const body = await res.json();
  const agent = (body.data as Array<{ id: string; phone: string }>).find((a) => a.phone === phone);
  if (!agent) throw new Error(`No admin agent found with phone ${phone}`);
  return agent.id;
}

test.describe("Admin Agent Detail", () => {
  test("renders the seeded verified agent's profile, stats and booking table", async ({ page, request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const id = await findAgentIdByPhone(request, adminToken, SEED_AGENT_PHONE);

    await loginAdminUI(page);
    await page.goto(`/admin/agents/${id}`);

    await expect(page.locator("h1")).toHaveText("Rohit Kumar");
    await expect(page.getByText(SEED_AGENT_PHONE)).toBeVisible();
    await expect(page.getByText("Rating")).toBeVisible();
    await expect(page.getByText("Jobs done")).toBeVisible();
    await expect(page.getByText("Bookings assigned")).toBeVisible();
    await expect(page.getByText("Revenue generated")).toBeVisible();

    // Service history table renders without error — pagination controls are
    // fine to be disabled/hidden if there's only one page of data.
    await expect(page.getByText("Service history")).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });

  test("Aadhar docs view/hide toggle changes visible state (local, no API call)", async ({ page, request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const id = await findAgentIdByPhone(request, adminToken, SEED_AGENT_PHONE);

    await loginAdminUI(page);
    await page.goto(`/admin/agents/${id}`);

    // `exact: true` matters on "View": Playwright matches accessible names by
    // substring, so a bare "View" also matches the sidebar's "Overview" group
    // toggle and the click fails on a strict-mode violation.
    await expect(page.getByText("Documents are hidden.")).toBeVisible();
    await page.getByRole("button", { name: "View", exact: true }).click();
    await expect(page.getByText("Documents are hidden.")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Hide", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Hide", exact: true }).click();
    await expect(page.getByText("Documents are hidden.")).toBeVisible();
  });

  test("suspend then reinstate the seeded verified agent from the detail page", async ({ page, request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const id = await findAgentIdByPhone(request, adminToken, SEED_AGENT_PHONE);

    await loginAdminUI(page);
    await page.goto(`/admin/agents/${id}`);

    // Status changes go through a confirmation dialog — see PersonFormModal's
    // ConfirmActionModal and the "verification asks for confirmation" spec.
    const suspendBtn = page.getByRole("button", { name: "Suspend", exact: true });
    await expect(suspendBtn).toBeVisible();
    const suspendRespPromise = page.waitForResponse(
      (r) => r.url().includes(`/admin/agents/${id}/status`) && r.request().method() === "PATCH",
    );
    await suspendBtn.click();
    await page.getByRole("dialog").getByRole("button", { name: "Suspend", exact: true }).click();
    expect((await suspendRespPromise).ok()).toBeTruthy();

    const reinstateBtn = page.getByRole("button", { name: /Reinstate/i });
    await expect(reinstateBtn).toBeVisible();
    const reinstateRespPromise = page.waitForResponse(
      (r) => r.url().includes(`/admin/agents/${id}/status`) && r.request().method() === "PATCH",
    );
    await reinstateBtn.click();
    await page.getByRole("dialog").getByRole("button", { name: "Verify", exact: true }).click();
    expect((await reinstateRespPromise).ok()).toBeTruthy();

    await expect(page.getByRole("button", { name: "Suspend", exact: true })).toBeVisible();
  });

  test("Verify button on a fresh pending agent's detail page calls PATCH status", async ({ page, request }) => {
    const { name } = await seedPendingAgent(request, "Detail Verify E2E Agent");
    const { token: adminToken } = await loginAsAdminApi(request);

    // Names are unique enough here (stamped with a random phone suffix in the helper).
    const listRes = await request.get(apiUrl("/admin/agents"), { headers: authHeader(adminToken) });
    const agents = (await listRes.json()).data as Array<{ id: string; name: string }>;
    const agent = agents.find((a) => a.name === name);
    expect(agent, `Seeded pending agent "${name}" should be visible to admin`).toBeTruthy();

    await loginAdminUI(page);
    await page.goto(`/admin/agents/${agent!.id}`);
    await expect(page.locator("h1")).toHaveText(name);

    const verifyBtn = page.getByRole("button", { name: "Verify", exact: true });
    await expect(verifyBtn).toBeVisible();
    const verifyRespPromise = page.waitForResponse(
      (r) => r.url().includes(`/admin/agents/${agent!.id}/status`) && r.request().method() === "PATCH",
    );
    await verifyBtn.click();
    await page.getByRole("dialog").getByRole("button", { name: "Verify", exact: true }).click();
    expect((await verifyRespPromise).ok()).toBeTruthy();

    await expect(page.getByRole("button", { name: "Suspend", exact: true })).toBeVisible();
  });
});

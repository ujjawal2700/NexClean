import { test, expect } from "@playwright/test";
import { authHeader } from "../fixtures/api-client";
import { apiUrl, loginAsAdminApi, loginAsPendingAgentApi, loginAsNewCustomerApi } from "../fixtures/admin-api-helpers";

/**
 * Campaigns can target agents, not just customers.
 *
 * The audience label is the wire format — it's stored on the Campaign document
 * and echoed back by the client — so these tests pin the exact strings as well
 * as the filters behind them.
 */

test.describe("Campaign audiences", () => {
  test("GET /admin/campaigns/audiences groups customer and agent options", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.get(apiUrl("/admin/campaigns/audiences"), { headers: authHeader(token) });
    expect(res.ok()).toBeTruthy();

    const groups = (await res.json()).data as { label: string; audiences: string[] }[];
    expect(groups.map((g) => g.label)).toEqual(["Customers", "Agents"]);
    expect(groups[0].audiences).toContain("All customers");
    expect(groups[1].audiences).toEqual(["All agents", "Verified agents", "Online agents"]);
  });

  test("audience-sizes reports a count for every agent audience", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    await loginAsPendingAgentApi(request); // make sure at least one agent exists

    const sizes = (await (await request.get(apiUrl("/admin/campaigns/audience-sizes"), { headers: authHeader(token) })).json())
      .data as Record<string, number>;

    for (const label of ["All agents", "Verified agents", "Online agents"]) {
      expect(typeof sizes[label], `${label} should have a size`).toBe("number");
    }
    expect(sizes["All agents"]).toBeGreaterThan(0);
    // Narrower audiences are subsets of the broad one.
    expect(sizes["Verified agents"]).toBeLessThanOrEqual(sizes["All agents"]);
    expect(sizes["Online agents"]).toBeLessThanOrEqual(sizes["Verified agents"]);
  });

  test("sending to agents reaches agents and not the customer base", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { token: agentToken } = await loginAsPendingAgentApi(request);
    const { token: customerToken } = await loginAsNewCustomerApi(request);

    const title = `Ops notice ${Date.now()}`;
    const res = await request.post(apiUrl("/admin/campaigns"), {
      headers: authHeader(adminToken),
      data: { title, body: "Please update your availability for tomorrow.", audience: "All agents" },
    });
    expect(res.status()).toBe(201);
    const campaign = (await res.json()).data as { audience: string; sentCount: number };
    expect(campaign.audience).toBe("All agents");
    expect(campaign.sentCount).toBeGreaterThan(0);

    const agentFeed = (await (await request.get(apiUrl("/notifications"), { headers: authHeader(agentToken) })).json())
      .data as { title: string }[];
    expect(agentFeed.some((n) => n.title === title)).toBe(true);

    const customerFeed = (await (await request.get(apiUrl("/notifications"), { headers: authHeader(customerToken) })).json())
      .data as { title: string }[];
    expect(customerFeed.some((n) => n.title === title)).toBe(false);
  });

  test("sending to customers does not reach agents", async ({ request }) => {
    const { token: adminToken } = await loginAsAdminApi(request);
    const { token: agentToken } = await loginAsPendingAgentApi(request);

    const title = `Customer promo ${Date.now()}`;
    const res = await request.post(apiUrl("/admin/campaigns"), {
      headers: authHeader(adminToken),
      data: { title, body: "20% off this weekend.", audience: "All customers" },
    });
    expect(res.status()).toBe(201);

    const agentFeed = (await (await request.get(apiUrl("/notifications"), { headers: authHeader(agentToken) })).json())
      .data as { title: string }[];
    expect(agentFeed.some((n) => n.title === title)).toBe(false);
  });

  test("an unrecognised audience is rejected rather than defaulting to all customers", async ({ request }) => {
    const { token } = await loginAsAdminApi(request);
    const res = await request.post(apiUrl("/admin/campaigns"), {
      headers: authHeader(token),
      data: { title: "Oops", body: "Typo in the audience label", audience: "All Agents" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/unknown audience/i);
  });

  test("campaign routes require admin auth", async ({ request }) => {
    expect((await request.get(apiUrl("/admin/campaigns/audiences"))).status()).toBe(401);
    expect(
      (await request.post(apiUrl("/admin/campaigns"), { data: { title: "x", body: "y", audience: "All agents" } })).status(),
    ).toBe(401);
  });
});

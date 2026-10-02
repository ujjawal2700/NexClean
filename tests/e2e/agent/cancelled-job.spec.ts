import { loginAgentUI } from "../../fixtures/ui-helpers";
import { authHeader, loginAsAdmin, apiUrl } from "../../fixtures/api-client";
import { test, expect, seedAssignedJob, SEED_AGENT_PHONE } from "../../fixtures/agent-e2e-helpers";

// A booking the customer or an admin cancels while the cleaner is on it must
// stop being "the current job", show as cancelled, and refuse further work —
// marking it complete used to flip it back to completed and pay out.
test.describe("A job cancelled while the cleaner is on it", () => {
  test("is shown as cancelled, not active, and can't be worked", async ({ page, request }) => {
    test.setTimeout(90_000);
    const { bookingId, agentToken } = await seedAssignedJob(request);

    // Cleaner has set off.
    const started = await request.patch(`/agent/jobs/${bookingId}/advance`, { headers: authHeader(agentToken) });
    expect(started.ok()).toBeTruthy();

    // Admin cancels mid-way.
    const { token: adminToken } = await loginAsAdmin(request);
    const cancel = await request.patch(apiUrl(`/admin/bookings/${bookingId}/status`), {
      headers: authHeader(adminToken),
      data: { status: "cancelled" },
    });
    expect(cancel.ok()).toBeTruthy();

    // The API reports it cancelled, paying nothing.
    const jobs = (await (await request.get("/agent/jobs", { headers: authHeader(agentToken) })).json()).data as Array<{
      id: string;
      status: string;
      payout: number;
    }>;
    const job = jobs.find((j) => j.id === bookingId);
    expect(job?.status).toBe("cancelled");
    expect(job?.payout).toBe(0);

    // And refuses further work, leaving the booking cancelled.
    const advance = await request.patch(`/agent/jobs/${bookingId}/advance`, { headers: authHeader(agentToken) });
    expect(advance.status()).toBe(400);
    expect((await advance.json()).message).toContain("cancelled");
    const photo = await request.post(`/agent/jobs/${bookingId}/photo`, {
      headers: authHeader(agentToken),
      data: { kind: "before", image: "data:image/png;base64,iVBORw0KGgo=" },
    });
    expect(photo.status()).toBe(400);
    const adminView = await request.get(apiUrl(`/admin/bookings/${bookingId}`), { headers: authHeader(adminToken) });
    expect((await adminView.json()).data.status).toBe("cancelled");

    // The app: not the current job on Today, cancelled on the job screen, no action button.
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent");
    await expect(page.getByText(/Current job|You're all caught up/)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`a[href="/agent/jobs/${bookingId}"]`)).toHaveCount(0);

    await page.goto(`/agent/jobs/${bookingId}`);
    await expect(page.getByTestId("job-cancelled")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /I've arrived|Start|Mark complete/ })).toHaveCount(0);
    await expect(page.getByTestId("job-navigate")).toHaveCount(0);

    await page.goto("/agent/jobs");
    await expect(page.locator(`a[href="/agent/jobs/${bookingId}"]`)).toHaveCount(0); // not under "Active"
  });
});

import { loginAgentUI } from "../../fixtures/ui-helpers";
import { authHeader, loginAsAdmin, apiUrl } from "../../fixtures/api-client";
import { test, expect, seedAssignedJob, SEED_AGENT_PHONE, TINY_PNG_DATA_URI } from "../../fixtures/agent-e2e-helpers";

// A cleaner who can't make an accepted job gives it back (with a reason); it
// goes back out to other cleaners instead of waiting for an admin.
test.describe("Giving back an assigned job", () => {
  test("Can't do this job? → reason → the job is released and re-dispatched", async ({ page, request }) => {
    test.setTimeout(90_000);
    const { bookingId, agentToken } = await seedAssignedJob(request);
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto(`/agent/jobs/${bookingId}`);

    await page.getByTestId("release-job").click();
    const confirm = page.getByTestId("confirm-release-job");
    await expect(confirm).toBeDisabled(); // a reason is required
    await page.getByRole("radio", { name: "My vehicle broke down" }).click();
    await confirm.click();
    await expect(page).toHaveURL(/\/agent$/);

    // No longer this cleaner's job.
    const jobs = (await (await request.get("/agent/jobs", { headers: authHeader(agentToken) })).json()).data as Array<{ id: string }>;
    expect(jobs.some((j) => j.id === bookingId)).toBe(false);

    // Back in dispatch, with the reason on record.
    const { token: admin } = await loginAsAdmin(request);
    const detail = (await (await request.get(apiUrl(`/admin/bookings/${bookingId}`), { headers: authHeader(admin) })).json()).data;
    expect(detail.agent).toBeNull();
    expect(["searching", "offered", "pending_admin", "assigned"]).toContain(detail.dispatchStatus);
  });

  test("can't give back a job once cleaning has started", async ({ request }) => {
    test.setTimeout(90_000);
    const { bookingId, agentToken } = await seedAssignedJob(request);
    // assigned → enroute → arrived, then force-start via photos.
    for (let i = 0; i < 2; i++) await request.patch(`/agent/jobs/${bookingId}/advance`, { headers: authHeader(agentToken) });
    for (let p = 0; p < 4; p++) {
      await request.post(`/agent/jobs/${bookingId}/photo`, {
        headers: authHeader(agentToken),
        data: { kind: "before", image: TINY_PNG_DATA_URI },
      });
    }
    const started = await request.patch(`/agent/jobs/${bookingId}/advance`, { headers: authHeader(agentToken) });
    expect((await started.json()).data?.status).toBe("in_progress");

    const res = await request.post(`/agent/jobs/${bookingId}/release`, {
      headers: authHeader(agentToken),
      data: { reason: "Changed my mind" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("already started cleaning");
  });
});

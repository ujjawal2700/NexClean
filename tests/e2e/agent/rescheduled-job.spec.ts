import { loginAgentUI } from "../../fixtures/ui-helpers";
import { authHeader, loginAsAdmin, loginAsAgent } from "../../fixtures/api-client";
import { test, expect, seedAssignedJob, SEED_AGENT_PHONE } from "../../fixtures/agent-e2e-helpers";

type AgentJob = { id: string; slot: string; rescheduleConfirmationToken: string | null };

test("customer reschedule reaches the accepted agent live, persists, and requires a fresh availability answer", async ({ page, request }) => {
  test.setTimeout(90_000);
  const { bookingId, agentToken, agentId, customerToken } = await seedAssignedJob(request);
  const { token: adminToken } = await loginAsAdmin(request);
  const jobs = async (): Promise<AgentJob[]> => (await (await request.get("/agent/jobs", { headers: authHeader(agentToken) })).json()).data;
  const move = async (days: number) => {
    const date = new Date(Date.now() + days * 86400000).toISOString();
    const res = await request.patch(`/bookings/${bookingId}/reschedule`, {
      headers: authHeader(customerToken), data: { date, slot: "11:00 AM" },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    return date;
  };
  const answer = (token: string, available: boolean, session = agentToken) => request.post(`/agent/jobs/${bookingId}/reschedule-response`, {
    headers: authHeader(session), data: { token, available },
  });
  try {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto(`/agent/jobs/${bookingId}`);
    await expect(page.getByTestId("release-job")).toBeVisible();
    const date = await move(3);
    const dialog = page.getByTestId("rescheduled-job-dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 }); // no refresh
    await expect(dialog).toContainText(new Date(date).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric",
    }));
    const first = (await jobs()).find((j) => j.id === bookingId)!;
    expect(first.rescheduleConfirmationToken).toBeTruthy();
    expect(first.slot).toBe("11:00 AM");
    const blocked = await request.patch(`/agent/jobs/${bookingId}/advance`, { headers: authHeader(agentToken) });
    expect(blocked.status()).toBe(409);

    // A different agent cannot answer on this cleaner's behalf.
    const other = await loginAsAgent(request, "9000000002");
    expect((await answer(first.rescheduleConfirmationToken!, true, other.token)).status()).toBe(409);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(dialog).toBeVisible(); // saved on the booking, not just a socket popup
    await dialog.getByRole("button", { name: "Yes, I'm available" }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await jobs()).find((j) => j.id === bookingId)?.rescheduleConfirmationToken).toBeNull();
    const detail = (await (await request.get(`/admin/bookings/${bookingId}`, { headers: authHeader(adminToken) })).json()).data;
    expect(detail.dispatchStatus).toBe("assigned");

    // A second move invalidates the previous answer, including old decline buttons.
    await move(4);
    await expect(dialog).toBeVisible();
    expect((await answer(first.rescheduleConfirmationToken!, true)).status()).toBe(409);
    expect((await answer(first.rescheduleConfirmationToken!, false)).status()).toBe(409);
    const second = (await jobs()).find((j) => j.id === bookingId)!;
    expect(second.rescheduleConfirmationToken).not.toBe(first.rescheduleConfirmationToken);
    await dialog.getByRole("button", { name: "I'm not available" }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await jobs()).some((j) => j.id === bookingId)).toBe(false);
    const released = (await (await request.get(`/admin/bookings/${bookingId}`, { headers: authHeader(adminToken) })).json()).data;
    expect(released.agent?.id).not.toBe(agentId);
    expect(["searching", "offered", "pending_admin", "assigned"]).toContain(released.dispatchStatus);
  } finally {
    await request.patch(`/admin/bookings/${bookingId}/cancel`, { headers: authHeader(adminToken) });
  }
});

import { loginAgentUI } from "../../fixtures/ui-helpers";
import { SEED_AGENT_PHONE } from "../../fixtures/api-client";
import { test, expect, seedAssignedJob, tinyPngFile } from "../../fixtures/agent-e2e-helpers";

test.describe("Jobs list", () => {
  test("shows a seeded assigned job under Active/All, and hides it under Completed", async ({ page, request }) => {
    const { bookingId } = await seedAssignedJob(request);
    await loginAgentUI(page, SEED_AGENT_PHONE);

    await page.goto("/agent/jobs");
    await expect(page.locator("h1")).toHaveText("Jobs");

    // Default filter is "Active" -- the freshly assigned job should be visible.
    const jobLink = page.locator(`a[href="/agent/jobs/${bookingId}"]`);
    await expect(jobLink).toBeVisible();
    await expect(jobLink.getByText("Test Car")).toBeVisible();
    await expect(jobLink.getByText("Assigned")).toBeVisible();

    // Completed tab should NOT show this (still-assigned) job.
    await page.getByRole("button", { name: "Completed" }).click();
    await expect(page.locator(`a[href="/agent/jobs/${bookingId}"]`)).not.toBeVisible();

    // All tab shows it again.
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.locator(`a[href="/agent/jobs/${bookingId}"]`)).toBeVisible();
  });

  test("clicking a job card navigates to its detail page", async ({ page, request }) => {
    const { bookingId } = await seedAssignedJob(request);
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/jobs");
    await page.locator(`a[href="/agent/jobs/${bookingId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/agent/jobs/${bookingId}$`));
  });
});

test.describe("Job detail: status flow, photos, area alert", () => {
  test("advances assigned -> enroute -> arrived, and the area alert card appears while arrived", async ({ page, request }) => {
    const { bookingId } = await seedAssignedJob(request);
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto(`/agent/jobs/${bookingId}`);

    const primaryButton = page.getByRole("button", { name: /Start — I'm on my way|I've arrived|Start cleaning|Mark complete/ });
    // Status badge in the job header card (the status-progress stepper below also renders the label text).
    const statusBadge = page.getByText("Assigned", { exact: true }).first();

    await expect(statusBadge).toBeVisible();
    await expect(primaryButton).toHaveText("Start — I'm on my way");

    await primaryButton.click();
    await expect(page.getByText("On the way", { exact: true }).first()).toBeVisible();
    await expect(primaryButton).toHaveText("I've arrived");

    await primaryButton.click();
    await expect(page.getByText("Arrived", { exact: true }).first()).toBeVisible();
    await expect(primaryButton).toHaveText("Start cleaning");

    // Area alert card shows up once arrived, and sending it updates the CTA text.
    await expect(page.getByText("NexClean Nearby")).toBeVisible();
    const notifyButton = page.getByRole("button", { name: "Notify nearby customers" });
    await expect(notifyButton).toBeVisible();
    await notifyButton.click();
    await expect(page.getByText(/Alert sent to \d+ nearby customer\(s\)/)).toBeVisible();
  });

  test("blocks completion until both before/after photos are uploaded, then allows it", async ({ page, request }) => {
    const { bookingId } = await seedAssignedJob(request);
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto(`/agent/jobs/${bookingId}`);

    const primaryButton = page.getByRole("button", { name: /Start — I'm on my way|I've arrived|Start cleaning|Mark complete/ });
    await primaryButton.click(); // -> enroute
    await primaryButton.click(); // -> arrived
    await primaryButton.click(); // -> in_progress
    await expect(page.getByText("Cleaning", { exact: true })).toBeVisible();
    await expect(primaryButton).toHaveText("Mark complete");

    // Missing photos: the completion button is disabled and hints why.
    await expect(primaryButton).toBeDisabled();
    await expect(page.getByText("Add both before & after photos to mark complete.")).toBeVisible();

    // Upload before + after photos via the hidden file inputs.
    const fileInputs = page.locator('input[type="file"][accept="image/*"]');
    await expect(fileInputs).toHaveCount(2);
    await fileInputs.nth(0).setInputFiles(tinyPngFile("before.png")); // Before tile
    await fileInputs.nth(1).setInputFiles(tinyPngFile("after.png")); // After tile

    // Once both photos are recorded server-side (jobs query refetches), the button un-disables.
    await expect(primaryButton).toBeEnabled({ timeout: 10_000 });

    await primaryButton.click(); // -> completed
    await expect(page.getByText("Job completed")).toBeVisible();
    await expect(page.getByText("added to your earnings", { exact: false })).toBeVisible();
  });

  test("a failed photo upload is shown and retryable instead of silently blocking completion", async ({ page, request }) => {
    const { bookingId } = await seedAssignedJob(request);
    await loginAgentUI(page, SEED_AGENT_PHONE);

    // Fail the first "before" upload the way a flaky mobile connection or an
    // oversized payload would. This used to be invisible: the tile showed the
    // local preview with a tick, the server never recorded the photo, and
    // "Mark complete" stayed disabled with no way to recover.
    let failNext = true;
    await page.route("**/agent/jobs/*/photo", async (route) => {
      if (failNext && route.request().postData()?.includes('"before"')) {
        failNext = false;
        await route.fulfill({
          status: 413,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: "Payload too large" }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`/agent/jobs/${bookingId}`);
    const primaryButton = page.getByRole("button", { name: /Start — I'm on my way|I've arrived|Start cleaning|Mark complete/ });
    await primaryButton.click(); // -> enroute
    await primaryButton.click(); // -> arrived
    await primaryButton.click(); // -> in_progress
    await expect(primaryButton).toHaveText("Mark complete");

    const fileInputs = page.locator('input[type="file"][accept="image/*"]');
    await fileInputs.nth(0).setInputFiles(tinyPngFile("before.png"));
    await fileInputs.nth(1).setInputFiles(tinyPngFile("after.png"));

    // The failure is surfaced, and the hint tells the agent what to do.
    const retry = page.getByText("Retry upload");
    await expect(retry).toBeVisible();
    await expect(page.getByText(/A photo didn't upload/)).toBeVisible();
    await expect(primaryButton).toBeDisabled();

    // Retrying the same photo (no re-shoot) unblocks completion.
    await retry.click();
    await expect(retry).toBeHidden();
    await expect(primaryButton).toBeEnabled({ timeout: 10_000 });

    await primaryButton.click();
    await expect(page.getByText("Job completed")).toBeVisible();
  });
});

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
    const statusBadge = page.getByText("Assigned", { exact: true }).first();

    await expect(statusBadge).toBeVisible();
    await expect(primaryButton).toHaveText("Start — I'm on my way");

    await primaryButton.click();
    await expect(page.getByText("On the way", { exact: true }).first()).toBeVisible();
    await expect(primaryButton).toHaveText("I've arrived");

    await primaryButton.click();
    await expect(page.getByText("Arrived", { exact: true }).first()).toBeVisible();
    await expect(primaryButton).toHaveText("Start cleaning");
    await expect(primaryButton).toBeDisabled(); // Gated on 4 before photos

    // Area alert card shows up once arrived, and sending it updates the CTA text.
    await expect(page.getByText("NexClean Nearby")).toBeVisible();
    const notifyButton = page.getByRole("button", { name: "Notify nearby customers" });
    await expect(notifyButton).toBeVisible();
    await notifyButton.click();
    await expect(page.getByText(/Alert sent to \d+ nearby customer\(s\)/)).toBeVisible();
  });

  test("blocks start cleaning without 4 before photos, and blocks completion without 4 after photos", async ({ page, request }) => {
    const { bookingId } = await seedAssignedJob(request);
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto(`/agent/jobs/${bookingId}`);

    const primaryButton = page.getByRole("button", { name: /Start — I'm on my way|I've arrived|Start cleaning|Mark complete/ });
    await primaryButton.click(); // -> enroute
    await primaryButton.click(); // -> arrived
    await expect(primaryButton).toHaveText("Start cleaning");
    await expect(primaryButton).toBeDisabled();
    await expect(page.getByText("Upload 4 more mandatory before photo(s) to start cleaning.")).toBeVisible();

    const beforeInput = page.locator('input[data-testid="upload-before-input"]');
    const afterInput = page.locator('input[data-testid="upload-after-input"]');

    // Upload 4 before photos
    for (let i = 0; i < 4; i++) {
      const photoResp = page.waitForResponse(
        (r) => r.url().includes(`/agent/jobs/${bookingId}/photo`) && r.status() === 200,
      );
      await beforeInput.setInputFiles(tinyPngFile(`before-${i}.png`));
      await photoResp;
    }

    // Now start cleaning is unblocked
    await expect(primaryButton).toBeEnabled({ timeout: 10_000 });
    await primaryButton.click(); // -> in_progress

    await expect(page.getByText("Cleaning", { exact: true }).first()).toBeVisible();
    await expect(primaryButton).toHaveText("Mark complete");
    await expect(primaryButton).toBeDisabled();
    await expect(page.getByText("Upload 4 more mandatory after photo(s) to mark complete.")).toBeVisible();

    // Upload 4 after photos
    for (let i = 0; i < 4; i++) {
      const photoResp = page.waitForResponse(
        (r) => r.url().includes(`/agent/jobs/${bookingId}/photo`) && r.status() === 200,
      );
      await afterInput.setInputFiles(tinyPngFile(`after-${i}.png`));
      await photoResp;
    }

    // Now mark complete is unblocked
    await expect(primaryButton).toBeEnabled({ timeout: 10_000 });
    await primaryButton.click(); // -> completed
    await expect(page.getByText("Job completed")).toBeVisible();
    await expect(page.getByText("added to your earnings", { exact: false })).toBeVisible();
  });
});

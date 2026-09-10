import { test, expect } from "@playwright/test";
import { SEED_AGENT_PHONE } from "../../fixtures/api-client";
import { loginAgentUI } from "../../fixtures/ui-helpers";
import { NEAR_LAT, NEAR_LNG } from "../../fixtures/agent-e2e-helpers";

test.describe("Agent dashboard + online toggle", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: NEAR_LAT, longitude: NEAR_LNG });
  });

  test("greets the agent by name and shows today's stats", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await expect(page.locator("h1")).toHaveText("Rohit Kumar 👋");
    // Stat tiles: Jobs today / Completed / Earned today / Potential.
    await expect(page.getByText("Jobs today")).toBeVisible();
    await expect(page.getByText("Completed")).toBeVisible();
    await expect(page.getByText("Earned today")).toBeVisible();
    await expect(page.getByText("Potential")).toBeVisible();
  });

  test("online toggle flips state, shows the offline banner, and persists across reload", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    const toggle = page.locator("header").getByRole("button", { name: /Online|Offline/ });
    await expect(toggle).toBeVisible();

    // Establish the starting state rather than inherit it. The seeded agent is
    // shared with the API suite, which runs first and deliberately takes these
    // agents offline while testing dispatch eligibility — so "starts online"
    // held only by luck of ordering, and this failed whenever that luck ran out.
    if ((await toggle.textContent())?.trim() === "Offline") {
      await toggle.click();
    }
    await expect(toggle).toHaveText("Online");
    await expect(page.getByText("You're offline", { exact: false })).not.toBeVisible();

    // Flip to offline.
    await toggle.click();
    await expect(toggle).toHaveText("Offline");
    await expect(page.getByText("toggle online (top right) to receive new jobs", { exact: false })).toBeVisible();

    // Persists across reload.
    await page.reload();
    await expect(page.locator("header").getByRole("button", { name: /Online|Offline/ })).toHaveText("Offline");

    // Flip back to online.
    await page.locator("header").getByRole("button", { name: /Online|Offline/ }).click();
    await expect(page.locator("header").getByRole("button", { name: /Online|Offline/ })).toHaveText("Online");
    await page.reload();
    await expect(page.locator("header").getByRole("button", { name: /Online|Offline/ })).toHaveText("Online");
  });

  test("shows 'You're all caught up' with no active job, or the active job card when one exists", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    // Either state is valid depending on what other specs have seeded; just assert one of them renders correctly.
    const emptyState = page.getByText("You're all caught up");
    const currentJobHeading = page.getByText("Current job");
    await expect(emptyState.or(currentJobHeading)).toBeVisible({ timeout: 15_000 });
  });
});

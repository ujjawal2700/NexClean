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

  test("mobile navigation floats above the Android system-control area", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAgentUI(page, SEED_AGENT_PHONE);

    const nav = page.getByTestId("agent-mobile-nav");
    const shell = nav.locator(".mobile-bottom-nav-shell");
    await expect(shell).toBeVisible();
    await expect.poll(async () =>
      shell.evaluate((element) => window.innerHeight - element.getBoundingClientRect().bottom),
    ).toBeGreaterThanOrEqual(20);

    const activePill = nav.locator(".mobile-bottom-nav-active");
    const beforeX = (await activePill.boundingBox())?.x ?? 0;
    await nav.getByRole("link", { name: "Jobs" }).click();
    await expect(page).toHaveURL(/\/agent\/jobs$/);
    await expect.poll(async () => (await activePill.boundingBox())?.x ?? 0).toBeGreaterThan(beforeX + 50);
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
    await expect(page.getByTestId("duty-card")).toContainText("You're online");
    await expect(page.getByTestId("duty-card")).toContainText("even if you close the app");

    // Flip to offline.
    await toggle.click();
    await expect(toggle).toHaveText("Offline");
    await expect(page.getByTestId("duty-card")).toContainText("You're offline");

    // Persists across reload.
    await page.reload();
    await expect(page.locator("header").getByRole("button", { name: /Online|Offline/ })).toHaveText("Offline");

    // Flip back to online.
    const onlineRequest = page.waitForRequest((request) => {
      if (!request.url().includes("/agent/online") || request.method() !== "PATCH") return false;
      return (request.postDataJSON() as { online?: boolean }).online === true;
    });
    await page.locator("header").getByRole("button", { name: /Online|Offline/ }).click();
    const onlineBody = (await onlineRequest).postDataJSON() as { lat?: number; lng?: number };
    expect(onlineBody.lat).toBeCloseTo(NEAR_LAT, 4);
    expect(onlineBody.lng).toBeCloseTo(NEAR_LNG, 4);
    await expect(page.locator("header").getByRole("button", { name: /Online|Offline/ })).toHaveText("Online");
    await page.reload();
    await expect(page.locator("header").getByRole("button", { name: /Online|Offline/ })).toHaveText("Online");
  });

  test("the Today card's own switch takes the cleaner online and offline (phones have no header)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAgentUI(page, SEED_AGENT_PHONE);
    const card = page.getByTestId("duty-card");
    const sw = page.getByTestId("duty-switch");
    if ((await sw.getAttribute("aria-checked")) === "true") await sw.click();
    await expect(card).toContainText("You're offline");

    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await expect(card).toContainText("You're online");
    // The test browser has no real push token, so the card says alerts need notifications.
    await expect(page.getByTestId("push-off-warning")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("duty-switch")).toHaveAttribute("aria-checked", "true");
  });

  test("shows 'You're all caught up' with no active job, or the active job card when one exists", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    // Either state is valid depending on what other specs have seeded; just assert one of them renders correctly.
    const emptyState = page.getByText("You're all caught up");
    const currentJobHeading = page.getByText("Current job");
    await expect(emptyState.or(currentJobHeading)).toBeVisible({ timeout: 15_000 });
  });
});

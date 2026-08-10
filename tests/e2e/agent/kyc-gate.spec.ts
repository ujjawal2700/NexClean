import { test, expect } from "@playwright/test";
import { SEED_PENDING_AGENT_PHONE } from "../../fixtures/api-client";
import { loginAgentUI } from "../../fixtures/ui-helpers";

test.describe("KYC gate (pending agent)", () => {
  test("shows the 'Application under review' screen instead of the dashboard", async ({ page }) => {
    await loginAgentUI(page, SEED_PENDING_AGENT_PHONE);
    await expect(page).toHaveURL(/\/agent$/);
    await expect(page.locator("h1")).toHaveText("Application under review");
    // Only the logout action is available -- no dashboard chrome (nav, toggle, stats).
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Today" })).not.toBeVisible();
  });

  test("blocks direct navigation to protected routes as well", async ({ page }) => {
    await loginAgentUI(page, SEED_PENDING_AGENT_PHONE);
    await expect(page.locator("h1")).toHaveText("Application under review");

    await page.goto("/agent/jobs");
    await expect(page.locator("h1")).toHaveText("Application under review");

    await page.goto("/agent/earnings");
    await expect(page.locator("h1")).toHaveText("Application under review");

    await page.goto("/agent/profile");
    await expect(page.locator("h1")).toHaveText("Application under review");
  });

  test("'Log out' clears the session and returns to the login page", async ({ page }) => {
    await loginAgentUI(page, SEED_PENDING_AGENT_PHONE);
    await expect(page.locator("h1")).toHaveText("Application under review");

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/agent\/login$/);

    // The JWT now lives in an httpOnly cookie, so the stronger guarantee is that
    // localStorage holds no credential at all — only the `authenticated` flag,
    // which logging out must clear.
    const persisted = await page.evaluate(() => localStorage.getItem("nexclean-agent-session"));
    const state = persisted ? JSON.parse(persisted).state : {};
    expect(state.token).toBeUndefined();
    expect(state.authenticated ?? false).toBe(false);

    // And the session cookie itself is gone, not just the local flag.
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "nc_session_agent")?.value || "").toBe("");

    // And the gate/dashboard is no longer reachable without logging back in.
    await page.goto("/agent");
    await expect(page).toHaveURL(/\/agent\/login$/);
  });
});

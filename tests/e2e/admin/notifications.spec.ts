import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin push notification campaigns", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/notifications");
    await expect(page.locator("h1")).toHaveText("Push Notifications");
  });

  test("compose and send a campaign end to end", async ({ page }) => {
    const title = `Weekend Sparkle Offer ${Date.now()}`;
    const body = "20% off this weekend only — book now!";

    await page.locator('input[name="title"]').fill(title);
    await page.locator("textarea").fill(body);
    // Pick an audience pill (defaults to "All customers" already selected).
    await page.getByRole("button", { name: /^Active customers/ }).click();

    const sendResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/campaigns") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Send campaign" }).click();
    const res = await sendResponse;
    expect(res.ok()).toBeTruthy();

    await expect(page.getByRole("button", { name: /Sent to \d/ })).toBeVisible();

    // Campaign appears in history.
    await expect(page.getByText(title)).toBeVisible();
  });

  test("the audience picker offers customer and agent groups", async ({ page }) => {
    // Scoped to the picker: "Agents" also appears in the sidebar nav.
    const picker = page.getByRole("group", { name: "Audience" });
    await expect(picker.getByText("Customers", { exact: true })).toBeVisible();
    await expect(picker.getByText("Agents", { exact: true })).toBeVisible();
    for (const label of ["All customers", "All agents", "Verified agents", "Online agents"]) {
      await expect(picker.getByRole("button", { name: new RegExp(`^${label}`) })).toBeVisible();
    }
  });

  test("sends a campaign to agents", async ({ page }) => {
    const title = `Ops notice ${Date.now()}`;

    await page.locator('input[name="title"]').fill(title);
    await page.locator("textarea").fill("Please update your availability for tomorrow.");
    await page.getByRole("button", { name: /^All agents/ }).click();
    await expect(page.getByRole("button", { name: /^All agents/ })).toHaveAttribute("aria-pressed", "true");

    const sendResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/campaigns") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Send campaign" }).click();
    expect((await sendResponse).ok()).toBeTruthy();

    await expect(page.getByRole("button", { name: /Sent to \d/ })).toBeVisible();

    // History records which audience it went to, not just that it was sent.
    // Scoped to this campaign's own row — the API specs seed other "All agents"
    // campaigns into the same database, so a page-wide match is ambiguous.
    const row = page.locator("div").filter({ has: page.getByText(title, { exact: true }) }).last();
    await expect(row).toBeVisible();
    await expect(row.getByText(/All agents ·/)).toBeVisible();
  });
});

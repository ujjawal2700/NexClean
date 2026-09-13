import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { SEED_AGENT_PHONE } from "../../fixtures/api-client";

test.describe("Admin Agents", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/agents");
    await expect(page.locator("h1")).toHaveText("Agents");
  });

  test("lists agents and supports search", async ({ page }) => {
    await expect(page.getByText("Rohit Kumar")).toBeVisible();

    await page.locator('input[name="search"]').fill(SEED_AGENT_PHONE);
    await expect(page.getByText("Rohit Kumar")).toBeVisible();

    await page.locator('input[name="search"]').fill("zzz-no-such-agent-zzz");
    await expect(page.getByText("No agents match your search.")).toBeVisible();

    await page.locator('input[name="search"]').fill("");
  });

  test("Export Excel asks for a date range, then downloads an .xlsx workbook", async ({ page }) => {
    await page.locator('input[name="search"]').fill(SEED_AGENT_PHONE);
    await expect(page.getByText("Rohit Kumar")).toBeVisible();

    await page.getByRole("button", { name: /Export Excel/i }).click();
    await expect(page.getByText("Export Agents")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^nexclean-agents-.+\.xlsx$/);
  });

  test("filter pills narrow the list", async ({ page }) => {
    const cards = page.locator("div.glass");
    await expect(cards.first()).toBeVisible();

    await page.getByRole("button", { name: "Verified" }).click();
    await page.waitForTimeout(150);
    await expect(page.getByText("Rohit Kumar")).toBeVisible();

    await page.getByRole("button", { name: "Suspended" }).click();
    await page.waitForTimeout(150);
    // Seeded agent is verified, so it should not appear under Suspended.
    await expect(page.getByText("Rohit Kumar")).not.toBeVisible();

    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByText("Rohit Kumar")).toBeVisible();
  });

  test("inline area editor updates the agent's area via PATCH", async ({ page }) => {
    await page.locator('input[name="search"]').fill(SEED_AGENT_PHONE);
    const card = page.locator("div.glass", { hasText: "Rohit Kumar" });
    await expect(card).toBeVisible();

    const newArea = `Green Valley Society Test ${Date.now()}`;

    await card.getByLabel("Edit area").click();
    const areaInput = card.locator("input");
    await areaInput.fill(newArea);

    const respPromise = page.waitForResponse(
      (r) => /\/admin\/agents\/.+\/area$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await card.getByLabel("Save area").click();
    const resp = await respPromise;
    expect(resp.ok()).toBeTruthy();
    await expect(card.getByText(newArea)).toBeVisible();

    // Restore the original area so this test is repeatable and doesn't pollute shared seed data.
    const restoreArea = "Green Valley Society";
    await card.getByLabel("Edit area").click();
    await card.locator("input").fill(restoreArea);
    const restoreRespPromise = page.waitForResponse(
      (r) => /\/admin\/agents\/.+\/area$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await card.getByLabel("Save area").click();
    await restoreRespPromise;
  });

  test("area editor cancel button discards the edit without calling the API", async ({ page }) => {
    await page.locator('input[name="search"]').fill(SEED_AGENT_PHONE);
    const card = page.locator("div.glass", { hasText: "Rohit Kumar" });
    await expect(card).toBeVisible();

    await card.getByLabel("Edit area").click();
    await card.locator("input").fill("This edit should be discarded");
    await card.getByLabel("Cancel").click();

    await expect(card.locator("input")).toHaveCount(0);
    await expect(card.getByText("This edit should be discarded")).not.toBeVisible();
  });

  test("suspend then reinstate the seeded agent via PATCH status", async ({ page }) => {
    await page.locator('input[name="search"]').fill(SEED_AGENT_PHONE);
    const card = page.locator("div.glass", { hasText: "Rohit Kumar" });
    await expect(card).toBeVisible();

    const suspendBtn = card.getByRole("button", { name: /Suspend/i });
    await expect(suspendBtn).toBeVisible();

    const suspendRespPromise = page.waitForResponse(
      (r) => /\/admin\/agents\/.+\/status$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await suspendBtn.click();
    const suspendResp = await suspendRespPromise;
    expect(suspendResp.ok()).toBeTruthy();

    const reinstateBtn = card.getByRole("button", { name: /Reinstate/i });
    await expect(reinstateBtn).toBeVisible();

    const reinstateRespPromise = page.waitForResponse(
      (r) => /\/admin\/agents\/.+\/status$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await reinstateBtn.click();
    const reinstateResp = await reinstateRespPromise;
    expect(reinstateResp.ok()).toBeTruthy();

    await expect(card.getByRole("button", { name: /Suspend/i })).toBeVisible();
  });
});

import { test, expect, type APIRequestContext } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { authHeader, ADMIN_EMAIL, ADMIN_PASSWORD } from "../../fixtures/api-client";
import { apiUrl } from "../../fixtures/admin-e2e-ops-helpers";

// The admin-e2e project's `request` baseURL is the frontend, so backend calls
// go through the absolute apiUrl() helper — same pattern as the sibling specs.
async function loginAsAdminApi(request: APIRequestContext) {
  const res = await request.post(apiUrl("/auth/admin-login"), {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) throw new Error(`admin-login failed: ${await res.text()}`);
  return { token: (await res.json()).data.token as string };
}

/** Off-peak hours are global config — restore a clean slate so other specs are unaffected. */
async function resetOffPeakHours(request: APIRequestContext) {
  const { token } = await loginAsAdminApi(request);
  await request.put(apiUrl("/admin/off-peak-hours"), {
    headers: authHeader(token),
    data: { timezone: "Asia/Kolkata", active: true, windows: [] },
  });
}

test.describe("Admin off-peak hours", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetOffPeakHours(request);
    await loginAdminUI(page);
    await page.goto("/admin/off-peak-hours");
    await expect(page.locator("h1")).toHaveText("Off-Peak Hours");
  });

  test.afterAll(async ({ request }) => {
    await resetOffPeakHours(request);
  });

  test("is reachable from the sidebar", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("link", { name: "Off-Peak Hours" }).click();
    await expect(page).toHaveURL(/\/admin\/off-peak-hours$/);
    await expect(page.locator("h1")).toHaveText("Off-Peak Hours");
  });

  test("renders a card for every weekday, each empty by default", async ({ page }) => {
    for (const day of ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]) {
      await expect(page.getByText(day, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Full price all day", { exact: false })).toHaveCount(7);
  });

  test("adds a window on Sunday and persists it across a reload", async ({ page }) => {
    await page.getByTestId("off-peak-day-0").getByRole("button", { name: "Add window" }).click();

    await page.getByLabel("Sunday window start").fill("08:00");
    await page.getByLabel("Sunday window end").fill("12:00");
    await page.getByLabel("Sunday window label").fill("Sunday morning rush");

    const save = page.waitForResponse(
      (res) => res.url().includes("/admin/off-peak-hours") && res.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Save changes" }).click();
    const response = await save;
    expect(response.status()).toBe(200);

    await page.reload();
    await expect(page.getByLabel("Sunday window start")).toHaveValue("08:00");
    await expect(page.getByLabel("Sunday window end")).toHaveValue("12:00");
    await expect(page.getByLabel("Sunday window label")).toHaveValue("Sunday morning rush");
  });

  test("blocks saving a window that ends before it starts", async ({ page }) => {
    await page.getByTestId("off-peak-day-1").getByRole("button", { name: "Add window" }).click();

    await page.getByLabel("Monday window start").fill("18:00");
    await page.getByLabel("Monday window end").fill("09:00");

    await expect(page.getByText("End must be after start")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  test("blocks saving two overlapping windows on the same day", async ({ page }) => {
    const tuesdayCard = page.getByTestId("off-peak-day-2");
    await tuesdayCard.getByRole("button", { name: "Add window" }).click();
    await tuesdayCard.getByRole("button", { name: "Add window" }).click();

    const starts = page.getByLabel("Tuesday window start");
    const ends = page.getByLabel("Tuesday window end");
    await starts.nth(0).fill("10:00");
    await ends.nth(0).fill("14:00");
    await starts.nth(1).fill("12:00");
    await ends.nth(1).fill("16:00");

    await expect(page.getByText("Overlaps another window on this day")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  test("the master switch pauses off-peak discounts and persists", async ({ page }) => {
    await expect(page.getByText("Off-peak discounts are live")).toBeVisible();

    await page.getByText("Off-peak discounts are live").click();
    await expect(page.getByText("Off-peak discounts are paused")).toBeVisible();

    const save = page.waitForResponse(
      (res) => res.url().includes("/admin/off-peak-hours") && res.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Save changes" }).click();
    await save;

    await page.reload();
    await expect(page.getByText("Off-peak discounts are paused")).toBeVisible();
  });

  test("Save is disabled until something actually changes", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();

    await page.getByTestId("off-peak-day-5").getByRole("button", { name: "Add window" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  test("a window can be removed again", async ({ page }) => {
    const wedCard = page.getByTestId("off-peak-day-3");
    await wedCard.getByRole("button", { name: "Add window" }).click();
    await expect(page.getByLabel("Wednesday window start")).toBeVisible();

    await wedCard.getByRole("button", { name: "Remove window" }).click();
    await expect(page.getByLabel("Wednesday window start")).toHaveCount(0);
  });

  test("a timezone preset can be applied", async ({ page }) => {
    await page.getByRole("button", { name: "Asia/Dubai", exact: true }).click();
    await expect(page.locator('input[name="timezone"]')).toHaveValue("Asia/Dubai");

    const save = page.waitForResponse(
      (res) => res.url().includes("/admin/off-peak-hours") && res.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Save changes" }).click();
    expect((await save).status()).toBe(200);

    await page.reload();
    await expect(page.locator('input[name="timezone"]')).toHaveValue("Asia/Dubai");
  });

  test("the peak upgrade fee persists", async ({ page }) => {
    // Off-peak config is a singleton document, not per-test data — a prior
    // run may have already left the fee at 175, which would make Save a
    // no-op change (button stays disabled forever). Pick whichever of two
    // values differs from what's on screen right now.
    const feeInput = page.locator('input[name="peakUpgradeFee"]');
    const current = await feeInput.inputValue();
    const nextFee = current === "175" ? "180" : "175";
    await feeInput.fill(nextFee);

    const save = page.waitForResponse(
      (res) => res.url().includes("/admin/off-peak-hours") && res.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Save changes" }).click();
    expect((await save).status()).toBe(200);

    await page.reload();
    await expect(page.locator('input[name="peakUpgradeFee"]')).toHaveValue(nextFee);
  });

  test("a negative fee blocks saving", async ({ page }) => {
    await page.locator('input[name="peakUpgradeFee"]').fill("-5");
    await expect(page.getByText("Enter a fee of ₹0 or more")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  /**
   * The suggestion is a draft, not a price change. This asserts the whole point
   * of that design: running it shows the numbers and leaves the stored config
   * exactly as it was.
   */
  test("Suggest shows a demand grid and changes nothing on its own", async ({ page, request }) => {
    await page.getByRole("button", { name: "Suggest" }).click();
    await expect(page.getByText(/booking(s)? over the last/)).toBeVisible({ timeout: 10000 });

    // One row per weekday.
    for (const day of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      await expect(page.getByRole("cell", { name: day, exact: true })).toBeVisible();
    }
    await expect(page.getByText("Nothing is saved until you press Save changes.")).toBeVisible();

    const { token } = await loginAsAdminApi(request);
    const config = (await (
      await request.get(apiUrl("/admin/off-peak-hours"), { headers: authHeader(token) })
    ).json()).data as { windows: unknown[] };
    expect(config.windows, "Suggest must not write the config").toHaveLength(0);
  });
});

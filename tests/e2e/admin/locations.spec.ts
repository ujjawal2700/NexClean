import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin locations (cities & zones)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/locations");
    await expect(page.locator("h1")).toHaveText("Locations");
  });

  test("create a city, toggle it, add a zone inside it, delete the zone, then the city", async ({ page }) => {
    const cityName = `TestCity${Date.now()}`;
    const zoneName = `TestZone${Date.now()}`;

    // --- Create city ---
    await page.getByPlaceholder("Type city name (e.g. Bengaluru)").fill(cityName);
    const createCityResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/cities") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add" }).first().click();
    await createCityResponse;

    // Scoped to the Cities panel specifically: once the city is selectable
    // in the zones panel's <select>, its name also appears verbatim as an
    // <option>; and once a zone is added under it, the zone row repeats the
    // city name as a subtitle — so an unscoped getByText(cityName) becomes
    // a strict-mode violation (multiple matches) once those exist.
    const citiesPanel = page.locator(".glass").filter({ hasText: "Cities" }).first();
    const cityNameEl = citiesPanel.locator("p").filter({ hasText: cityName });
    await expect(cityNameEl).toBeVisible();
    const cityRow = cityNameEl.locator("xpath=..");

    // --- Toggle city active/inactive and back ---
    const toggleOffResponse = page.waitForResponse(
      (res) => /\/admin\/cities\//.test(res.url()) && res.request().method() === "PATCH",
    );
    await cityRow.getByRole("button", { name: /^(Active|Inactive)$/ }).click();
    await toggleOffResponse;
    await expect(cityRow.getByRole("button", { name: "Inactive" })).toBeVisible();

    const toggleOnResponse = page.waitForResponse(
      (res) => /\/admin\/cities\//.test(res.url()) && res.request().method() === "PATCH",
    );
    await cityRow.getByRole("button", { name: "Inactive" }).click();
    await toggleOnResponse;
    await expect(cityRow.getByRole("button", { name: "Active" })).toBeVisible();

    // --- Select the new city in the zones panel and add a zone ---
    const citySelect = page.locator("select");
    await citySelect.selectOption({ label: cityName });
    const zoneNameInput = page.getByPlaceholder("Type zone / society name");
    await expect(zoneNameInput).toBeEnabled();
    await zoneNameInput.fill(zoneName);

    const createZoneResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/zones") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add" }).last().click();
    await createZoneResponse;

    const zoneNameEl = page.getByText(zoneName, { exact: true });
    await expect(zoneNameEl).toBeVisible();
    // Zone row: name+city wrapper div, then the row div two levels up (sibling of the buttons div).
    const zoneRow = zoneNameEl.locator("xpath=../..");

    // --- Deleting the city while its zone still exists should fail (400) ---
    const blockedDeleteResponse = page.waitForResponse(
      (res) => /\/admin\/cities\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "DELETE",
    );
    await cityRow.locator("button").last().click();
    const blockedRes = await blockedDeleteResponse;
    expect(blockedRes.status()).toBe(400);
    await expect(cityNameEl).toBeVisible(); // still present — delete was rejected

    // --- Delete the zone first ---
    const deleteZoneResponse = page.waitForResponse(
      (res) => /\/admin\/zones\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "DELETE",
    );
    await zoneRow.locator("button").last().click();
    await deleteZoneResponse;
    await expect(zoneNameEl).toHaveCount(0);

    // --- Now delete the city — should succeed ---
    const deleteCityResponse = page.waitForResponse(
      (res) => /\/admin\/cities\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "DELETE",
    );
    await cityRow.locator("button").last().click();
    const deleteCityRes = await deleteCityResponse;
    expect(deleteCityRes.ok()).toBeTruthy();
    await expect(cityNameEl).toHaveCount(0);
  });
});

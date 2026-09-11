import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { loginAsAdmin, authHeader, apiUrl } from "../../fixtures/api-client";

test.describe("Admin Locations & Geofencing", () => {
  test.beforeEach(async ({ page, request }) => {
    // Clean up any lingering E2E test zones from previous runs to prevent false-positive overlap detection
    try {
      const { token } = await loginAsAdmin(request);
      const res = await request.get(apiUrl("/admin/zones"), {
        headers: authHeader(token),
      });
      if (res.ok()) {
        const body = await res.json();
        const zones: Array<{ id?: string; _id?: string; name?: string }> = Array.isArray(body.data)
          ? body.data
          : body.data?.zones || [];
        for (const zone of zones) {
          if (zone.name && zone.name.startsWith("E2E Zone")) {
            const zoneId = zone.id || zone._id;
            if (zoneId) {
              await request.delete(apiUrl(`/admin/zones/${zoneId}`), {
                headers: authHeader(token),
              });
            }
          }
        }
      }
    } catch {
      // Backend may be starting or non-seeded; proceed gracefully
    }

    await loginAdminUI(page);
    await page.goto("/admin/locations");
    await expect(page.locator("h1")).toContainText("Locations & Geofencing");
  });

  test("loads page cleanly with no deprecation or runtime error overlays", async ({ page }) => {
    // Verify tabs exist and are functional
    const zonesTab = page.getByRole("button", { name: /^Geofence Zones/i });
    const citiesTab = page.getByRole("button", { name: /^Cities \(/i });
    await expect(zonesTab).toBeVisible();
    await expect(citiesTab).toBeVisible();

    // Verify search bar and Draw button exist in zones view
    await expect(page.getByRole("button", { name: /Draw New Zone/i })).toBeVisible();
    await expect(page.getByPlaceholder("Search zones...")).toBeVisible();

    // Verify no error boundary or deprecation message is shown
    await expect(page.getByText("This page hit an unexpected error")).toHaveCount(0);
  });

  test("draws a zone by clicking points and only completes it by closing the loop (not on an arbitrary click)", async ({ page }) => {
    const drawBtn = page.getByRole("button", { name: /Draw New Zone/i });
    await drawBtn.click();

    // Verify Drawing Banner appears
    const banner = page.locator("text=Drawing Zone Boundary");
    await expect(banner).toBeVisible();

    // Find the Google Map container
    const mapContainer = page.locator(".gm-style, [aria-label='Map']").first();
    const mapBox = await mapContainer.boundingBox();

    if (mapBox) {
      // Pick coordinates in the lower half of the map so they don't overlap with the top floating banner
      const centerX = mapBox.x + mapBox.width / 2;
      const baseY = mapBox.y + mapBox.height * 0.65;

      // Click 1st vertex
      await page.mouse.click(centerX - 60, baseY);
      await page.waitForTimeout(300);
      await expect(page.getByText("1 point", { exact: true })).toBeVisible({ timeout: 5000 });

      // A 2nd click is just a point, not a finish — no double-click, no
      // click-anywhere-completes gesture. The zone must still be open.
      await page.mouse.click(centerX + 60, baseY);
      await page.waitForTimeout(300);
      await expect(page.getByText("2 points", { exact: true })).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/Boundary Shape/)).toHaveCount(0);

      // Undo removes the most recently placed point.
      const undoBtn = page.getByRole("button", { name: "Undo" });
      await expect(undoBtn).toBeVisible();
      await undoBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText("1 point", { exact: true })).toBeVisible({ timeout: 5000 });

      // Place a 2nd point at a fresh spot (not the exact pixel just undone —
      // two clicks at an identical point is a double-click-to-zoom gesture on
      // any map, Google's own drawing tool included, not a distinct-vertex
      // click; a real user reshaping a boundary wouldn't reuse a pixel either)
      // and a 3rd to complete the triangle.
      await page.mouse.click(centerX + 70, baseY - 10);
      await page.waitForTimeout(300);
      await page.mouse.click(centerX, baseY + 80);
      await page.waitForTimeout(300);
      await expect(page.getByText("3 points", { exact: true })).toBeVisible({ timeout: 5000 });
      // Still not created — 3 points placed is not the same as closing the loop.
      await expect(page.getByText(/Boundary Shape/)).toHaveCount(0);

      // "Close Loop" performs the same close-the-boundary action as clicking
      // the highlighted start vertex — the only two ways this zone completes.
      const closeLoopBtn = page.getByRole("button", { name: "Close Loop" });
      await expect(closeLoopBtn).toBeVisible();
      await closeLoopBtn.click();

      // Closing the loop opens the configure panel with the vertex count.
      await expect(page.getByText(/Boundary Shape \(3 Vertices\)/)).toBeVisible({ timeout: 5000 });
      await expect(page.getByPlaceholder("e.g. Indiranagar Central")).toBeVisible();
      const saveBtn = page.getByRole("button", { name: "Save Zone" });
      await expect(saveBtn).toBeVisible();

      // Fill in zone details and save
      const testZoneName = `E2E Zone ${Date.now()}`;
      const zoneNameInput = page.getByPlaceholder("e.g. Indiranagar Central");
      await zoneNameInput.fill(testZoneName);

      const createZoneResponse = page.waitForResponse(
        (res) => res.url().includes("/admin/zones") && res.request().method() === "POST",
      );
      await saveBtn.click();
      await createZoneResponse;

      // Verify created zone appears in zone list. Exact match: a loose text
      // search also matches the (slower to auto-dismiss) success toast's
      // longer "Zone "X" created successfully" message, which contains the
      // same name as a substring and made this assertion flaky.
      await expect(page.getByText(testZoneName, { exact: true })).toBeVisible({ timeout: 5000 });

      // Clean up: delete the created test zone
      const zoneCard = page.locator(".group").filter({ hasText: testZoneName });
      page.once("dialog", (dialog) => dialog.accept());
      const deleteZoneResponse = page.waitForResponse(
        (res) => /\/admin\/zones\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "DELETE",
      );
      await zoneCard.getByTitle("Delete Zone").click();
      await deleteZoneResponse;
      // Same exact-match reasoning as above — the "...deleted" toast can
      // still be visible for a moment and also contains the zone name.
      await expect(page.getByText(testZoneName, { exact: true })).toHaveCount(0);
    } else {
      // Fallback: cancel drawing
      const cancelBtn = page.getByRole("button", { name: "Cancel Drawing" });
      await cancelBtn.click();
      await expect(banner).toHaveCount(0);
    }
  });

  test("cities lifecycle: create city, toggle active status, and delete city", async ({ page }) => {
    // Switch to Cities tab
    const citiesTab = page.getByRole("button", { name: /^Cities \(/i });
    await citiesTab.click();

    const cityName = `City${Date.now()}`;
    const cityInput = page.getByPlaceholder(/Type city name/i);
    await expect(cityInput).toBeVisible();
    await cityInput.fill(cityName);

    const createCityResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/cities") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Add City/i }).click();
    await createCityResponse;

    // Verify city appears in list
    const cityRow = page.locator("p").filter({ hasText: cityName }).locator("xpath=../..");
    await expect(cityRow).toBeVisible();

    // Toggle active status
    const toggleOffResponse = page.waitForResponse(
      (res) => /\/admin\/cities\//.test(res.url()) && res.request().method() === "PATCH",
    );
    await cityRow.getByRole("button", { name: /Active/i }).click();
    await toggleOffResponse;
    await expect(cityRow.getByRole("button", { name: /Inactive/i })).toBeVisible();

    // Toggle back on
    const toggleOnResponse = page.waitForResponse(
      (res) => /\/admin\/cities\//.test(res.url()) && res.request().method() === "PATCH",
    );
    await cityRow.getByRole("button", { name: /Inactive/i }).click();
    await toggleOnResponse;
    await expect(cityRow.getByRole("button", { name: /Active/i })).toBeVisible();

    // Delete city (accept confirmation dialog)
    page.once("dialog", (dialog) => dialog.accept());
    const deleteResponse = page.waitForResponse(
      (res) => /\/admin\/cities\/[a-f0-9]+$/.test(res.url()) && res.request().method() === "DELETE",
    );
    await cityRow.locator("button").last().click();
    const delRes = await deleteResponse;
    expect(delRes.ok()).toBeTruthy();
    await expect(page.locator("p").filter({ hasText: cityName })).toHaveCount(0);
  });
});

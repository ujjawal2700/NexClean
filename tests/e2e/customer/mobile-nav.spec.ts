import { test, expect, type Locator } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

// The bottom tab bar belongs to the top-level browsing tabs; nested screens have
// their own back button and must not show it.
const TAB_PAGES = ["/app", "/app/bookings", "/app/plans", "/app/profile"];
const NESTED_PAGES = [
  "/app/book", // Booking has its own persistent action bar.
  "/app/profile/edit",
  "/app/profile/refer",
  "/app/profile/refer/users",
  "/app/profile/vehicles",
  "/app/profile/addresses",
  "/app/wallet",
  "/app/notifications",
  "/app/help",
];

test.describe("Customer mobile tab bar", () => {
  test("shows only on the top-level browsing tabs", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginCustomerUI(page);
    const nav = page.getByTestId("customer-mobile-nav");

    for (const path of TAB_PAGES) {
      await page.goto(path);
      await expect(nav, `tab bar on ${path}`).toBeVisible();
    }
    for (const path of NESTED_PAGES) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect(nav, `no tab bar on ${path}`).toHaveCount(0);
    }
  });
});

/**
 * The tab bar slides up into place with a spring when the page mounts. Reading
 * tab positions mid-slide gives coordinates the bar is about to leave, so a
 * press there can miss the active tab entirely — which is what made the drag
 * test flaky. Wait until the bar's position stops changing before measuring.
 */
async function waitForBarToSettle(nav: Locator) {
  let last = "";
  await expect
    .poll(
      async () => {
        const b = await nav.boundingBox();
        const now = b ? `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}` : "";
        const settled = now !== "" && now === last;
        last = now;
        return settled;
      },
      { intervals: [100], timeout: 5_000 },
    )
    .toBe(true);
}

test.describe("Customer tab bar: liquid drag", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("press-and-drag the highlighted tab to another tab opens it", async ({ page }) => {
    test.setTimeout(60_000);
    await loginCustomerUI(page);
    await page.goto("/app");
    const nav = page.getByTestId("customer-mobile-nav");
    const pill = page.getByTestId("customer-mobile-nav-pill");
    await expect(pill).toBeVisible();
    await waitForBarToSettle(nav);

    const from = await nav.getByRole("link", { name: "Dashboard" }).boundingBox();
    const to = await nav.getByRole("link", { name: "Plans" }).boundingBox();
    if (!from || !to) throw new Error("tabs not laid out");
    const y = from.y + from.height / 2;

    await page.mouse.move(from.x + from.width / 2, y);
    await page.mouse.down();
    // Midway the pill follows the finger, before anything navigates.
    await page.mouse.move(from.x + from.width / 2 + 60, y, { steps: 6 });
    await expect(page).toHaveURL(/\/app$/);
    await expect(pill).toHaveClass(/is-dragging/);
    await page.mouse.move(to.x + to.width / 2, y, { steps: 12 });
    await page.mouse.up();

    await expect(page).toHaveURL(/\/app\/plans$/);
    await expect(pill).not.toHaveClass(/is-dragging/);
    // Settles centred under the Plans tab.
    await expect
      .poll(async () => {
        const b = await pill.boundingBox();
        return b ? Math.abs(b.x + b.width / 2 - (to.x + to.width / 2)) : 999;
      })
      .toBeLessThan(6);
  });

  test("a drag released back on the current tab stays put; a tap still navigates", async ({ page }) => {
    test.setTimeout(60_000);
    await loginCustomerUI(page);
    await page.goto("/app");
    const nav = page.getByTestId("customer-mobile-nav");
    await expect(nav).toBeVisible();
    await waitForBarToSettle(nav);
    const home = await nav.getByRole("link", { name: "Dashboard" }).boundingBox();
    if (!home) throw new Error("tab not laid out");
    const cx = home.x + home.width / 2;
    const y = home.y + home.height / 2;

    await page.mouse.move(cx, y);
    await page.mouse.down();
    await page.mouse.move(cx + 25, y, { steps: 4 });
    await page.mouse.move(cx, y, { steps: 4 });
    await page.mouse.up();
    await expect(page).toHaveURL(/\/app$/);

    await nav.getByRole("link", { name: "Bookings" }).click();
    await expect(page).toHaveURL(/\/app\/bookings$/);
  });
});

test.describe("Long-press on a touch phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("doesn't open the link menu or start a drag on tabs", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app");
    const tab = page.getByTestId("customer-mobile-nav").getByRole("link", { name: "Plans" });
    await expect(tab).toBeVisible();
    const blocked = await tab.evaluate((el) => {
      const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      const drag = new DragEvent("dragstart", { bubbles: true, cancelable: true });
      el.dispatchEvent(menu);
      el.dispatchEvent(drag);
      return {
        menu: menu.defaultPrevented,
        drag: drag.defaultPrevented,
        callout: getComputedStyle(el).getPropertyValue("-webkit-touch-callout") || "unsupported",
      };
    });
    expect(blocked.menu).toBe(true);
    expect(blocked.drag).toBe(true);
  });
});

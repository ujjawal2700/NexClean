import { test, expect } from "@playwright/test";

/**
 * The public marketing surface — the one app area that had no browser coverage
 * at all, despite being the first thing every customer sees.
 *
 * Copy on this page is admin-editable (it renders from the site-content API),
 * so these assert structure and behaviour — sections present, navigation works,
 * CTAs route correctly — rather than exact wording, which would break every
 * time someone edits the CMS.
 */

const SECTION_IDS = ["story", "how-it-works", "vehicles", "nearby", "why", "plans", "app", "reviews"];

test.describe("Landing page", () => {
  test("renders every story section, with no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("main#main")).toBeVisible();

    for (const id of SECTION_IDS) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    expect(errors).toEqual([]);
  });

  test("primary hero CTA routes into the booking flow", async ({ page }) => {
    await page.goto("/");
    // Scoped to <main>: the sticky header carries a "Book cleaning" button too,
    // so an unscoped lookup finds the nav one instead of the hero's.
    await page.locator("h1").waitFor();
    await page.locator("main").getByRole("button", { name: /book/i }).first().click();
    // Unauthenticated users are bounced to login on the way to /app/book.
    await page.waitForURL(/\/app\/(book|login)/);
  });

  test("nav links scroll to their sections", async ({ page }) => {
    await page.goto("/");
    await page.locator("h1").waitFor();

    for (const [label, id] of [
      ["How it works", "how-it-works"],
      ["Vehicles", "vehicles"],
      ["Plans", "plans"],
    ] as const) {
      await page.getByRole("button", { name: label, exact: true }).first().click();
      await expect(page.locator(`#${id}`)).toBeInViewport({ timeout: 10_000 });
    }
  });

  test("deep-linking with a hash lands on that section", async ({ page }) => {
    await page.goto("/#plans");
    await expect(page.locator("#plans")).toBeInViewport({ timeout: 10_000 });
  });

  test("an unknown path falls back to the landing page rather than a blank screen", async ({ page }) => {
    await page.goto("/definitely-not-a-real-route");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("main#main")).toBeVisible();
  });

  test("is usable at a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    // Assert the symptom a user would actually feel: the page must not drag
    // sideways. Regression guard for reveal animations parking elements at
    // translateX(40px) off-screen, which let the page scroll 19px right.
    const scrolledX = await page.evaluate(() => {
      const win = globalThis as unknown as { scrollTo: (x: number, y: number) => void; scrollX: number };
      win.scrollTo(300, 0);
      const x = win.scrollX;
      win.scrollTo(0, 0);
      return x;
    });
    expect(scrolledX).toBe(0);
  });
});

test.describe("Public content pages", () => {
  // Every one of these is reachable from the footer and is legally meaningful
  // (refund policy, terms, privacy), so a blank render matters.
  for (const path of ["/about", "/careers", "/contact", "/support", "/help", "/privacy", "/terms", "/refund"]) {
    test(`${path} renders content without erroring`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(400);
      await expect(page.locator("h1")).toBeVisible();

      const text = (await page.locator("body").innerText()).trim();
      expect(text.length).toBeGreaterThan(120);
      expect(errors).toEqual([]);
    });
  }
});

// Note: /contact is informational only — the lead form lives in the customer
// signup flow (unserviced city), covered by e2e/customer/signup.spec.ts.

import { test, expect } from "@playwright/test";

// Isolated routing checks: no real signup or backend writes.
const androidUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const data = path === "/api/auth/referral/check" ? { referrerName: "Aisha K." }
      : path === "/api/config/public" ? {} : [];
    return route.fulfill({ json: { success: true, data } });
  });
});

for (const path of ["/referral?code=aisha42", "/referral/aisha42", "/referral?ref=aisha42"]) {
  test(`desktop signup pre-fills ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/app\/signup\?ref=AISHA42$/);
    await expect(page.locator('input[name="referralCode"]')).toHaveValue("AISHA42");
    await expect(page.getByText("Referred by Aisha K.")).toBeVisible();
  });
}

test("Android landing provides an app intent with the correct store referral", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: androidUA, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route("https://play.google.com/**", route => route.fulfill({
    contentType: "text/html", body: "<p>Mock Play Store listing</p>",
  }));
  // Desktop Chromium can render an Android UA, but cannot resolve Android
  // intents. Check the real tap fallback and its encoded target instead.
  await page.goto(`${test.info().project.use.baseURL}/referral?code=aisha42`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Open NexClean", exact: true })).toHaveAttribute("href", /package=com\.nexclean\.customer;/);
  const url = new URL((await page.getByRole("link", { name: "Install from Google Play" }).getAttribute("href"))!);
  expect(url.searchParams.get("id")).toBe("com.nexclean.customer");
  expect(new URLSearchParams(url.searchParams.get("referrer")!).get("ref")).toBe("AISHA42");
  await context.close();
});

test("the Android app's WebView opens signup instead of returning to Play", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: androidUA });
  await context.addInitScript(() => {
    (window as unknown as { NexCleanApp: boolean }).NexCleanApp = true;
  });
  const page = await context.newPage();
  await page.route("**/api/**", route => {
    if (!new URL(route.request().url()).pathname.startsWith("/api/")) return route.continue();
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto(`${test.info().project.use.baseURL}/referral?code=aisha42`);
  await expect(page).toHaveURL(/\/app\/signup\?ref=AISHA42$/);
  await expect(page.locator('input[name="referralCode"]')).toHaveValue("AISHA42");
  await context.close();
});

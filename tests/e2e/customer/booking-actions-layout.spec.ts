import { test, expect, type Page } from "@playwright/test";

// All API calls are mocked: these checks cannot create or charge a booking.
async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("nexclean-session", JSON.stringify({ state: { authenticated: true, guest: false }, version: 0 }));
    localStorage.setItem("nexclean-cookie-consent", JSON.stringify({ version: 1, necessary: true, functional: false }));
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (path === "/api/payments/order") {
      await new Promise(resolve => setTimeout(resolve, 400));
      return route.fulfill({ status: 400, json: { success: false, message: "Please try again" } });
    }
    const data = path === "/api/auth/me" ? {
      id: "layout-customer", name: "Test Customer", role: "customer", phone: "9999999999",
      vehicles: Array.from({ length: 8 }, (_, i) => ({ id: `car-${i}`, type: "sedan", name: `Test car ${i}`, plate: "MP09AA1234" })),
      addresses: [{ id: "home", label: "Home", line: "Test street", coordinates: [75.8577, 22.7196] }],
    } : path === "/api/catalog/vehicle-categories" ? [{ id: "sedan", key: "sedan", label: "Sedan", basePrice: 200, active: true }]
      : path === "/api/catalog/time-slots" ? { slots: ["09:30 AM", "11:00 AM", "02:00 PM"], leadMinutes: 0 }
      : path === "/api/catalog/payment-mode" ? { online: false }
      : path === "/api/catalog/tax" ? { enabled: false }
      : path === "/api/users/me/wallet" ? { coins: 0 }
      : path === "/api/config/public" ? {} : [];
    return route.fulfill({ json: { success: true, data } });
  });
  // Keep layout checks independent of Google Maps network availability.
  await page.route("https://maps.googleapis.com/**", route => route.abort());
  await page.goto("/app/book");
  await expect(page.getByRole("heading", { name: "Which vehicle?" })).toBeVisible();
}

async function assertActionsVisible(page: Page, primary = "Continue") {
  const viewport = page.viewportSize()!;
  for (const button of [page.getByRole("button", { name: "Back", exact: true }), page.getByRole("button", { name: primary, exact: true })]) {
    await expect(button).toBeVisible();
    const bounds = (await button.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(48);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    const bottomClearance = viewport.height - bounds.y - bounds.height;
    expect(bottomClearance).toBeGreaterThanOrEqual(viewport.width < 1024 ? 48 : 12);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
}

for (const viewport of [{ width: 320, height: 480 }, { width: 360, height: 640 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
  test(`actions stay accessible throughout all five steps at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await setup(page);
    await expect(page.getByTestId("customer-mobile-nav")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
    await assertActionsVisible(page);
    const before = await page.getByTestId("booking-actions").boundingBox();
    await page.getByTestId("booking-step-content").evaluate(el => el.scrollTop = el.scrollHeight);
    expect((await page.getByTestId("booking-actions").boundingBox())!.y).toBe(before!.y);
    await assertActionsVisible(page);
    await page.getByRole("button", { name: /Test car 0/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Choose a package" })).toBeVisible();
    await expect.poll(() => page.getByTestId("booking-step-content").evaluate(el => el.scrollTop)).toBe(0);
    await assertActionsVisible(page);
    await page.getByRole("button", { name: /Express Wash/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Pick a date & time" })).toBeVisible();
    await assertActionsVisible(page);
    await page.locator("button").filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).nth(1).click();
    await page.getByRole("button", { name: "09:30 AM", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Where should we come?" })).toBeVisible();
    await assertActionsVisible(page);
    await page.getByTestId("select-address-home").click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(page.getByText("Review your total and confirm the booking.")).toBeVisible();
    await assertActionsVisible(page, "Pay ₹200");
    await page.getByTestId("booking-step-content").evaluate(el => el.scrollTop = el.scrollHeight);
    await assertActionsVisible(page, "Pay ₹200");
    await page.screenshot({ path: `/tmp/nexclean-booking-payment-${viewport.width}.png` });

    await page.getByRole("button", { name: "Pay ₹200", exact: true }).click();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
    await expect(page.getByRole("alert")).toHaveText("Please try again");
    await assertActionsVisible(page, "Pay ₹200");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Where should we come?" })).toBeVisible();
    await assertActionsVisible(page);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  });
}

test("actions follow a reduced viewport while entering vehicle details", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await setup(page);
  await page.getByRole("button", { name: "Can't find your car? Enter it manually" }).click();
  await page.getByPlaceholder("e.g. Hyundai").fill("Tata");
  await page.setViewportSize({ width: 360, height: 360 });
  await assertActionsVisible(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await assertActionsVisible(page);
});

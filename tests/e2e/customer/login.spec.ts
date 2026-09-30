import { test, expect } from "@playwright/test";
import { DEMO_OTP, LEGAL_ACCEPTANCE, freshPhone } from "../../fixtures/api-client";
import { API_BASE_URL } from "../../playwright.config";

test.describe("Customer login", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "nexclean-cookie-consent",
        JSON.stringify({ version: 1, necessary: true, functional: false, updatedAt: new Date().toISOString() }),
      );
    });
  });

  test("missing account dialog clearly explains signup and uses accessible full-size actions", async ({ page }) => {
    const phone = "9876543210";
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/auth/send-login-otp", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "NOT_REGISTERED: This mobile number is not registered. Kindly sign up first.",
        }),
      }),
    );

    await page.goto("/app/login");
    const phoneInput = page.locator('input[name="phone"]');
    await phoneInput.fill(phone);
    await page.getByRole("button", { name: "Send OTP" }).click();

    const dialog = page.getByRole("dialog", { name: "Your account was not found" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("+91 98765 43210")).toBeVisible();
    const signupButton = dialog.getByRole("button", { name: "Create my account" });
    await expect(signupButton).toBeFocused();
    const buttonBox = await signupButton.boundingBox();
    expect(buttonBox?.height).toBeGreaterThanOrEqual(52);
    expect(buttonBox?.width).toBeGreaterThan(280);
    expect(await page.locator("#root").evaluate((root) => (root as HTMLElement).inert)).toBe(true);

    await dialog.getByRole("button", { name: "Use another number" }).click();
    await expect(dialog).toBeHidden();
    await expect(phoneInput).toBeFocused();

    await page.getByRole("button", { name: "Send OTP" }).click();
    await page.getByRole("dialog", { name: "Your account was not found" })
      .getByRole("button", { name: "Create my account" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/app/signup\\?phone=${phone}$`));
    await expect(page.locator('input[name="phone"]')).toHaveValue(phone);
  });

  test("customer mobile navigation reserves space above the device system controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/login");
    await page.getByRole("button", { name: /Skip for now/ }).click();
    await expect(page).toHaveURL(/\/app$/);

    const nav = page.getByTestId("customer-mobile-nav");
    await expect(nav).toBeVisible();
    const shell = nav.locator(".mobile-bottom-nav-shell");
    await expect(shell).toBeVisible();
    await expect.poll(async () =>
      shell.evaluate((element) => window.innerHeight - element.getBoundingClientRect().bottom),
    ).toBeGreaterThanOrEqual(20);
    const layout = await nav.evaluate((element) => {
      const navStyle = getComputedStyle(element);
      const shell = element.querySelector<HTMLElement>(".mobile-bottom-nav-shell");
      const main = document.querySelector("main");
      const box = element.getBoundingClientRect();
      const shellBox = shell?.getBoundingClientRect();
      return {
        paddingBottom: Number.parseFloat(navStyle.paddingBottom),
        contentPaddingBottom: main ? Number.parseFloat(getComputedStyle(main).paddingBottom) : 0,
        navBottom: box.bottom,
        shellBottom: shellBox?.bottom ?? box.bottom,
        shellLeft: shellBox?.left ?? 0,
        shellRadius: shell ? Number.parseFloat(getComputedStyle(shell).borderRadius) : 0,
        viewportHeight: window.innerHeight,
      };
    });
    expect(layout.paddingBottom).toBeGreaterThanOrEqual(10);
    expect(layout.contentPaddingBottom).toBeGreaterThan(100);
    expect(layout.navBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.viewportHeight - layout.shellBottom).toBeGreaterThanOrEqual(20);
    expect(layout.shellLeft).toBeGreaterThan(8);
    expect(layout.shellRadius).toBeGreaterThanOrEqual(20);

    // The translucent active pill is a single shared-layout element. It
    // should spring horizontally to the newly selected tab, not blink out and
    // reappear as a disconnected highlight.
    const activePill = nav.locator(".mobile-bottom-nav-active");
    await expect(activePill).toHaveCount(1);
    const beforeX = (await activePill.boundingBox())?.x ?? 0;
    await nav.getByRole("link", { name: "Plans" }).click();
    await expect(page).toHaveURL(/\/app\/plans$/);
    await expect.poll(async () => (await activePill.boundingBox())?.x ?? 0).toBeGreaterThan(beforeX + 100);
  });

  test("rejects an invalid phone number", async ({ page }) => {
    await page.goto("/app/login");
    await expect(page.locator("h1")).toHaveText("Welcome back");
    await page.locator('input[name="phone"]').fill("123");
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.getByText("Enter a valid 10-digit number")).toBeVisible();
    // Still on the phone step.
    await expect(page.locator("h1")).toHaveText("Welcome back");
  });

  test("rejects a too-short OTP", async ({ page }) => {
    const phone = freshPhone();
    // send-login-otp 404s with NOT_REGISTERED for a phone with no account —
    // register it first so this test can reach the verify step (see
    // fixtures/ui-helpers.ts's loginCustomerUI doc for the full explanation).
    await page.request.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone, ...LEGAL_ACCEPTANCE } });
    await page.goto("/app/login");
    await page.locator('input[name="phone"]').fill(phone);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");
    await page.locator('input[name="otp"]').fill("123");
    await page.getByRole("button", { name: "Verify & continue" }).click();
    await expect(page.getByText("Enter the 6-digit code", { exact: true })).toBeVisible();
  });

  test("rejects a wrong OTP and stays on the verify step", async ({ page }) => {
    const phone = freshPhone();
    await page.request.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone, ...LEGAL_ACCEPTANCE } });
    await page.goto("/app/login");
    await page.locator('input[name="phone"]').fill(phone);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");
    await page.locator('input[name="otp"]').fill("000000");
    await page.getByRole("button", { name: "Verify & continue" }).click();
    await expect(page.getByText("Incorrect code")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Verify your number");
  });

  test("logs in with a correct OTP and lands on the dashboard", async ({ page }) => {
    const phone = freshPhone();
    await page.request.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone, ...LEGAL_ACCEPTANCE } });
    await page.goto("/app/login");
    await page.locator('input[name="phone"]').fill(phone);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");
    await page.locator('input[name="otp"]').fill(DEMO_OTP);
    await page.getByRole("button", { name: "Verify & continue" }).click();
    await page.waitForURL(/\/app$/);
    await expect(page).toHaveURL(/\/app$/);
  });

  test("Change number link returns to the phone step", async ({ page }) => {
    const phone = freshPhone();
    await page.request.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone, ...LEGAL_ACCEPTANCE } });
    await page.goto("/app/login");
    await page.locator('input[name="phone"]').fill(phone);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");
    await page.getByRole("button", { name: "Change number" }).click();
    await expect(page.locator("h1")).toHaveText("Welcome back");
  });

  test("visiting /app without a session redirects to login", async ({ page }) => {
    await page.goto("/app");
    await page.waitForURL(/\/app\/login$/);
    await expect(page.locator("h1")).toHaveText("Welcome back");
  });

  test("Create an account link navigates to signup", async ({ page }) => {
    await page.goto("/app/login");
    await page.getByRole("link", { name: "Create an account" }).click();
    await page.waitForURL(/\/app\/signup$/);
  });
});

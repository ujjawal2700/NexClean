import { test, expect } from "@playwright/test";
import { DEMO_OTP, freshPhone } from "../../fixtures/api-client";
import { API_BASE_URL } from "../../playwright.config";

test.describe("Customer login", () => {
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
    await page.request.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone } });
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
    await page.request.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone } });
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
    await page.request.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone } });
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
    await page.request.post(`${API_BASE_URL}/auth/customer/signup`, { data: { name: "Test Customer", phone } });
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

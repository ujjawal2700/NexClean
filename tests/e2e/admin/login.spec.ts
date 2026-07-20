import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../../fixtures/api-client";
import { loginAdminUI } from "../../fixtures/ui-helpers";

test.describe("Admin Login", () => {
  test("renders the sign-in form with a pre-filled email", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator("h1")).toHaveText("Sign in to manage NexClean");
    await expect(page.getByText("Admin Console")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toHaveValue(ADMIN_EMAIL);
    await expect(page.getByText("Demo: superadmin@gmail.com / password123")).toBeVisible();
  });

  test("wrong password is rejected with a visible inline error", async ({ page }) => {
    await page.goto("/admin/login");
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill("");
    await emailInput.fill(ADMIN_EMAIL);
    await page.locator('input[name="password"]').fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/Invalid email or password|Login failed/i)).toBeVisible();
    // Still on the login page — no navigation happened.
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("correct credentials land on the admin dashboard", async ({ page }) => {
    await loginAdminUI(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator("h1")).toHaveText("Dashboard");
  });

  test("the show/hide password toggle actually changes the input's type attribute", async ({ page }) => {
    await page.goto("/admin/login");
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill(ADMIN_PASSWORD);
    await expect(passwordInput).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("empty password shows client-side validation without hitting the API", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your password")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

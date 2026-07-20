import { test, expect } from "@playwright/test";
import { DEMO_OTP, freshPhone } from "../../fixtures/api-client";
import { tinyPngFile } from "../../fixtures/agent-e2e-helpers";

async function fillDetails(page: import("@playwright/test").Page, opts: { name: string; phone: string; area: string }) {
  await page.locator('input[name="name"]').fill(opts.name);
  await page.locator('input[name="phone"]').fill(opts.phone);
  await page.locator('input[name="area"]').fill(opts.area);
}

test.describe("Agent signup", () => {
  test("details step: validates name, phone and area before proceeding", async ({ page }) => {
    await page.goto("/agent/signup");
    await expect(page.locator("h1")).toHaveText("Join as a cleaner");

    // All empty -> name error first.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter your full name")).toBeVisible();

    // Valid name, bad phone -> phone error.
    await page.locator('input[name="name"]').fill("Test Cleaner");
    await page.locator('input[name="phone"]').fill("123");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a valid 10-digit number")).toBeVisible();

    // Valid name + phone, empty area -> area error.
    await page.locator('input[name="phone"]').fill(freshPhone());
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter the area / society you'll operate in")).toBeVisible();

    // Still on the details step throughout.
    await expect(page.locator("h1")).toHaveText("Join as a cleaner");
  });

  test("kyc step: validates aadhar number and requires both photos", async ({ page }) => {
    const phone = freshPhone();
    await page.goto("/agent/signup");
    await fillDetails(page, { name: "Test Cleaner", phone, area: "Green Valley Society" });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("h1")).toHaveText("Identity verification");

    // Malformed aadhar.
    await page.locator('input[name="aadhar"]').fill("123");
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByText("Aadhar number must be 12 digits")).toBeVisible();

    // Valid aadhar, but no photos uploaded yet.
    await page.locator('input[name="aadhar"]').fill("123456789012");
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByText("Upload both sides of your Aadhar card")).toBeVisible();

    // Still on the kyc step, not submitted.
    await expect(page.locator("h1")).toHaveText("Identity verification");
  });

  test("kyc step: 'Back' returns to the details step", async ({ page }) => {
    await page.goto("/agent/signup");
    await fillDetails(page, { name: "Test Cleaner", phone: freshPhone(), area: "Green Valley Society" });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("h1")).toHaveText("Identity verification");

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("Join as a cleaner");
  });

  test("full happy path: submits KYC with photos, verifies OTP, and lands on the KYC-gate pending screen", async ({ page }) => {
    const phone = freshPhone();
    await page.goto("/agent/signup");
    await fillDetails(page, { name: "Test Cleaner", phone, area: "Green Valley Society" });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("h1")).toHaveText("Identity verification");

    await page.locator('input[name="aadhar"]').fill("123456789012");
    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(tinyPngFile("aadhar-front.png"));
    await fileInputs.nth(1).setInputFiles(tinyPngFile("aadhar-back.png"));

    // Wait for both compressed data-URI previews to render before submitting.
    await expect(page.getByAltText("Aadhar front preview")).toBeVisible();
    await expect(page.getByAltText("Aadhar back preview")).toBeVisible();

    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");
    await expect(page.getByText(`+91 ${phone}`)).toBeVisible();

    await page.locator('input[name="otp"]').fill(DEMO_OTP);
    await page.getByRole("button", { name: "Verify & continue" }).click();

    // Brand new agent signups are agentStatus:"pending" -> KYC-gate status screen, not the dashboard.
    await page.waitForURL(/\/agent$/);
    await expect(page.locator("h1")).toHaveText("Application under review");
    await expect(page.getByText("Test Cleaner", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("otp step: 'Resend code' re-fires the send-otp request", async ({ page }) => {
    const phone = freshPhone();
    await page.goto("/agent/signup");
    await fillDetails(page, { name: "Test Cleaner", phone, area: "Green Valley Society" });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator('input[name="aadhar"]').fill("123456789012");
    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(tinyPngFile("aadhar-front.png"));
    await fileInputs.nth(1).setInputFiles(tinyPngFile("aadhar-back.png"));
    await expect(page.getByAltText("Aadhar front preview")).toBeVisible();
    await expect(page.getByAltText("Aadhar back preview")).toBeVisible();
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");

    const resendResponse = page.waitForResponse(
      (res) => res.url().includes("/auth/send-otp") && res.request().method() === "POST",
    );
    await page.getByText("Resend code").click();
    await resendResponse;
  });

  test("'Agent login' link goes back to the login page", async ({ page }) => {
    await page.goto("/agent/signup");
    await page.getByRole("link", { name: "Agent login" }).click();
    await expect(page).toHaveURL(/\/agent\/login$/);
  });
});

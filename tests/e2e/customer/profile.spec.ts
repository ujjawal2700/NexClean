import { test, expect } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

test.describe("Edit profile", () => {
  test.beforeEach(async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/profile/edit");
    await expect(page.locator("h1")).toHaveText("Edit Profile");
  });

  test("Save changes with empty name/email is a no-op (doesn't show Saved)", async ({ page }) => {
    // Note: the Save changes button itself is not visually disabled by empty
    // fields (only `updateProfile.isPending` disables it) — EditProfile.tsx's
    // saveDetails() guards on `!name.trim() || !email.trim()` internally and
    // simply returns without calling the API. Assert that no-op behavior
    // directly rather than a disabled state that doesn't exist.
    await page.locator('input[name="name"]').fill("");
    await page.locator('input[name="email"]').fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).not.toBeVisible();

    await page.locator('input[name="name"]').fill("Only Name");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).not.toBeVisible();
  });

  test("saves name and email, flipping the button label to Saved", async ({ page }) => {
    await page.locator('input[name="name"]').fill("Updated Name");
    await page.locator('input[name="email"]').fill("updated@example.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    // Reverts back to "Save changes" after ~2s.
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible({ timeout: 4000 });
  });

  test("phone-change sub-flow validates a too-short new number", async ({ page }) => {
    await page.getByRole("button", { name: "Change number" }).click();
    await page.locator('input[name="newPhone"]').fill("123");
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.getByText("Please enter a valid 10-digit number.")).toBeVisible();
  });

  test("phone-change sub-flow can be cancelled back to idle", async ({ page }) => {
    await page.getByRole("button", { name: "Change number" }).click();
    await page.locator('input[name="newPhone"]').fill("9876543210");
    // Two "Cancel" buttons exist on this page once the phone-change panel is
    // open (Personal Details card's Cancel, and this panel's own Cancel,
    // which renders later in the DOM) — scope to the last one.
    await page.getByRole("button", { name: "Cancel" }).last().click();
    await expect(page.getByRole("button", { name: "Change number" })).toBeVisible();
  });

  test("phone-change OTP step rejects a too-short OTP", async ({ page }) => {
    const newPhone = "9" + Math.floor(100000000 + Math.random() * 899999999).toString();
    await page.getByRole("button", { name: "Change number" }).click();
    await page.locator('input[name="newPhone"]').fill(newPhone);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.locator('input[name="phoneOtp"]')).toBeVisible();
    // Client only checks otp.length !== 6 for the Verify button being a no-op —
    // the mutation itself is guarded, so a short code simply doesn't submit.
    await page.locator('input[name="phoneOtp"]').fill("123");
    await page.getByRole("button", { name: "Verify & Save" }).click();
    // Still on the OTP step (no navigation, no crash).
    await expect(page.locator('input[name="phoneOtp"]')).toBeVisible();
  });

  test("Cancel returns to the profile page", async ({ page }) => {
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForURL(/\/app\/profile$/);
  });
});

test.describe("Profile page", () => {
  test.beforeEach(async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/profile");
    await expect(page.locator("h1")).toHaveText("Profile");
  });

  test("shows account summary and navigation links", async ({ page }) => {
    await expect(page.getByText("Account Summary")).toBeVisible();
    await expect(page.getByRole("link", { name: /Edit profile/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Wallet/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Refer & earn/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Your garage/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Saved addresses/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Help & Support/ })).toBeVisible();
  });

  test("logout flow: confirm modal, Cancel keeps the session", async ({ page }) => {
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Log Out" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Log Out" })).not.toBeVisible();
    // Still logged in.
    await expect(page.locator("h1")).toHaveText("Profile");
  });

  test("logout flow: confirming clears the session and redirects to login", async ({ page }) => {
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Log Out" })).toBeVisible();
    // Two buttons named "Log out"/"Log Out" exist once the modal is open —
    // scope to the modal's red confirm button (last in DOM order).
    await page.getByRole("button", { name: "Log out" }).last().click();
    await page.waitForURL(/\/app\/login$/);

    // Visiting /app directly afterwards redirects back to login.
    await page.goto("/app");
    await page.waitForURL(/\/app\/login$/);
  });
});

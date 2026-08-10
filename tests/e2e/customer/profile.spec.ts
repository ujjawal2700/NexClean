import { test, expect } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

test.describe("Edit profile", () => {
  test.beforeEach(async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/profile/edit");
    await expect(page.locator("h1")).toHaveText("Edit Profile");
    // The form seeds its fields from the `me` query in an effect, which would
    // otherwise overwrite whatever a test typed first.
    await expect(page.locator('input[name="name"]')).not.toHaveValue("");
  });

  // The page renders the shared <UserProfileEdit> component: one form for
  // name/email/phone saved by "Save Profile Changes", plus an OTP-gated
  // password section. There is no "Saved" button state and no phone-change
  // sub-flow — validation failures surface as inline messages instead.

  test("digits cannot be entered into the name field", async ({ page }) => {
    const name = page.locator('input[name="name"]');
    await name.fill("Agent 007");
    // The field filters disallowed characters on every change, so the digits
    // never survive typing — the submit-time guard is the second line only.
    await expect(name).toHaveValue("Agent ");
  });

  test("a malformed email never reaches the API", async ({ page }) => {
    let patched = false;
    page.on("request", (r) => {
      if (r.method() === "PATCH" && r.url().includes("/users/me")) patched = true;
    });

    await page.locator('input[name="name"]').fill("Valid Name");
    await page.locator('input[name="email"]').fill("not-an-email");
    await page.getByRole("button", { name: "Save Profile Changes" }).click();

    // type="email" inside a real <form>, so the browser blocks submission
    // before the handler runs — no request, and no success message.
    await expect(page.getByText("Profile details saved successfully")).not.toBeVisible();
    expect(patched).toBe(false);
  });

  test("rejects a mobile number that isn't 10 digits", async ({ page }) => {
    await page.locator('input[name="name"]').fill("Valid Name");
    await page.locator('input[name="phone"]').fill("12345");
    await page.getByRole("button", { name: "Save Profile Changes" }).click();
    await expect(page.getByText(/Mobile number must be exactly 10 digits/)).toBeVisible();
  });

  test("saves name and email and confirms with a success message", async ({ page }) => {
    await page.locator('input[name="name"]').fill("Updated Name");
    await page.locator('input[name="email"]').fill("updated@example.com");
    await page.getByRole("button", { name: "Save Profile Changes" }).click();
    await expect(page.getByText("Profile details saved successfully")).toBeVisible();

    // Survives a reload — i.e. it really persisted.
    await page.reload();
    await expect(page.locator('input[name="name"]')).toHaveValue("Updated Name");
    await expect(page.locator('input[name="email"]')).toHaveValue("updated@example.com");
  });

  test("accepts a name written in a non-Latin script", async ({ page }) => {
    // Regression guard: name validation used to be ASCII-only on both the
    // client and the server, so an Indian customer couldn't save their own
    // name in Devanagari.
    await page.locator('input[name="name"]').fill("जॉन कुमार");
    await page.getByRole("button", { name: "Save Profile Changes" }).click();
    await expect(page.getByText("Profile details saved successfully")).toBeVisible();
  });

  test("password change is OTP-gated: requesting a code reveals the OTP step", async ({ page }) => {
    await page.getByRole("button", { name: "Request OTP to Change Password" }).click();
    await expect(page.locator('input[name="otpCode"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify OTP" })).toBeVisible();
  });

  test("Back returns to the profile page", async ({ page }) => {
    // The Back control calls navigate(-1), so it needs a real previous entry —
    // land on /app/profile first, then walk into the editor.
    await page.goto("/app/profile");
    await page.goto("/app/profile/edit");
    await page.getByRole("button", { name: "Back" }).click();
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

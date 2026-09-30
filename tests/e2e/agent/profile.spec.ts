import { test, expect } from "@playwright/test";
import { SEED_AGENT_PHONE } from "../../fixtures/api-client";
import { loginAgentUI } from "../../fixtures/ui-helpers";

test.describe("Agent profile", () => {
  test("shows the agent's identity and account summary", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/profile");
    await expect(page.locator("h1")).toHaveText("Profile");
    await expect(page.getByRole("heading", { name: "Rohit Kumar" })).toBeVisible();
    await expect(page.getByText(`+91 ${SEED_AGENT_PHONE}`)).toBeVisible();
    await expect(page.getByTestId("agent-account-email")).toBeVisible();
  });

  test("online/offline toggle on the profile page updates availability", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 22.7196, longitude: 75.8577 });
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/profile");

    const availabilityToggle = page.getByRole("button", { name: /Go online|Go offline/ });
    await expect(availabilityToggle).toBeVisible();

    const initialText = await availabilityToggle.textContent();
    await availabilityToggle.click();
    await expect(availabilityToggle).not.toHaveText(initialText ?? "");

    // Toggle back to restore state for other tests.
    await availabilityToggle.click();
  });

  test("'Log out' shows a confirmation modal; Cancel dismisses it, confirming logs out", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/profile");

    await page.getByRole("button", { name: "Log out" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Log out of NexClean?" })).toBeVisible();
    await expect(dialog.getByText("live job updates", { exact: false })).toBeVisible();

    // Cancel keeps the session.
    await dialog.getByRole("button", { name: "Stay signed in" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/agent\/profile$/);

    // Confirm logs out.
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page).toHaveURL(/\/agent\/login$/);
  });

  test("navigates to Edit profile and Help & Support from the profile menu", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/profile");

    await page.getByRole("link", { name: /Edit profile/ }).click();
    await expect(page).toHaveURL(/\/agent\/profile\/edit$/);

    await page.goto("/agent/profile");
    await page.getByRole("link", { name: /Help & Support/ }).click();
    await expect(page).toHaveURL(/\/agent\/help$/);
  });
});

test.describe("Edit profile", () => {
  // Shares the <UserProfileEdit> component with the customer app: a single
  // "Save Profile Changes" submit with an inline success message, not a
  // button that flips to "Saved".

  test("name is editable and saving confirms with a success message", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/profile/edit");
    await expect(page.locator("h1")).toHaveText("Edit Profile");

    await expect(page.locator('input[name="phone"]')).toHaveValue(SEED_AGENT_PHONE);

    const nameInput = page.locator('input[name="name"]');
    const originalName = await nameInput.inputValue();

    /**
     * Save and wait for the request itself to land.
     *
     * The success banner lingers for ~3s, so asserting on its text a second
     * time passes instantly against the *previous* save's banner — the test
     * then ends and tears the page down mid-request, leaving this shared
     * seeded cleaner renamed and breaking the admin agent-detail spec that
     * expects "Rohit Kumar".
     */
    const save = async () => {
      const patched = page.waitForResponse(
        (r) => r.url().includes("/users/me") && r.request().method() === "PATCH" && r.status() === 200,
        { timeout: 15_000 },
      );
      await page.getByRole("button", { name: "Save Profile Changes" }).click();
      await patched;
    };

    try {
      await nameInput.fill("Rohit Kumar QA");
      await save();
      await expect(page.getByText("Profile details saved successfully")).toBeVisible();
      await expect(nameInput).toHaveValue("Rohit Kumar QA");
    } finally {
      // Always put the seeded name back, even if an assertion above failed.
      await nameInput.fill(originalName);
      await save();
    }
    await expect(nameInput).toHaveValue(originalName);
  });

  test("Back navigates to the profile page", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    // Back calls navigate(-1); give it a real previous history entry.
    await page.goto("/agent/profile");
    await page.goto("/agent/profile/edit");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/agent\/profile$/);
  });

  test("mobile edit page hides the bottom navbar and keeps actions inside the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 865 });
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/profile/edit");

    await expect(page.getByTestId("agent-mobile-nav")).toHaveCount(0);
    const otpButton = page.getByRole("button", { name: "Request OTP to Change Password" });
    await expect(otpButton).toBeVisible();
    const box = await otpButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320.5);
  });

  test("saved email appears in the agent account summary", async ({ page }) => {
    const updatedEmail = "rohit.agent.profile@example.com";
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/profile/edit");
    await expect(page.locator('input[name="name"]')).not.toHaveValue("");
    const emailInput = page.locator('input[name="email"]');
    const originalEmail = await emailInput.inputValue();

    const saveEmail = async (email: string) => {
      await emailInput.fill(email);
      const patched = page.waitForResponse(
        (response) => response.url().includes("/users/me") && response.request().method() === "PATCH" && response.ok(),
      );
      await page.getByRole("button", { name: "Save Profile Changes" }).click();
      await patched;
    };

    try {
      await saveEmail(updatedEmail);
      await page.goto("/agent/profile");
      await expect(page.getByTestId("agent-account-email")).toHaveText(updatedEmail);
    } finally {
      await page.goto("/agent/profile/edit");
      await expect(page.locator('input[name="name"]')).not.toHaveValue("");
      await page.locator('input[name="email"]').fill(originalEmail);
      const restored = page.waitForResponse(
        (response) => response.url().includes("/users/me") && response.request().method() === "PATCH" && response.ok(),
      );
      await page.getByRole("button", { name: "Save Profile Changes" }).click();
      await restored;
    }
  });
});

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
    await expect(page.getByRole("heading", { name: "Log Out" })).toBeVisible();
    await expect(page.getByText("Are you sure you want to log out", { exact: false })).toBeVisible();

    // Cancel keeps the session.
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Log Out" })).not.toBeVisible();
    await expect(page).toHaveURL(/\/agent\/profile$/);

    // Confirm logs out.
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("heading", { name: "Log Out" }).waitFor();
    await page.locator("button", { hasText: "Log out" }).last().click();
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
  test("name is editable, phone is read-only, and saving flips the button to 'Saved'", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/profile/edit");
    await expect(page.locator("h1")).toHaveText("Edit Profile");

    const phoneInput = page.locator('input[name="phone"]');
    await expect(phoneInput).toBeDisabled();
    await expect(phoneInput).toHaveValue(SEED_AGENT_PHONE);

    const nameInput = page.locator('input[name="name"]');
    const originalName = await nameInput.inputValue();
    await nameInput.fill("Rohit Kumar QA");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    // Restore original name so other specs relying on "Rohit Kumar 👋" keep passing.
    await nameInput.fill(originalName);
    await page.getByRole("button", { name: /Save changes|Saved/ }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  });

  test("'Cancel' navigates back to the profile page", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/profile/edit");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/agent\/profile$/);
  });
});

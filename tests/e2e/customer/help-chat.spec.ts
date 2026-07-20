import { test, expect } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

test.describe("Help & Support", () => {
  test.beforeEach(async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/help");
    await expect(page.locator("h1")).toHaveText("Help & Support");
  });

  test("FAQ accordion expands and collapses an entry (or shows the empty state)", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Frequently Asked Questions" })).toBeVisible();

    const faqButtons = page.locator("div.divide-y button");
    const count = await faqButtons.count();
    if (count === 0) {
      await expect(page.getByText("No FAQs available at the moment.")).toBeVisible();
      return;
    }

    const first = faqButtons.first();
    await first.click();
    // A second paragraph (the answer) should appear inside the same FAQ row.
    const answer = first.locator("xpath=../p");
    await expect(answer).toBeVisible();
    await first.click();
    await expect(answer).not.toBeVisible();
  });

  test("starting a live chat opens the thread and a message can be sent", async ({ page }) => {
    await page.getByRole("button", { name: /Start Live Chat|Resume Support Chat/ }).click();
    await expect(page.getByText("Live Chat Support")).toBeVisible();

    const messageInput = page.getByPlaceholder("Type your message here...");
    const sendButton = page.locator("div.border-t.p-4 button");

    await expect(sendButton).toBeDisabled();
    await messageInput.fill("Hello, I need help with a wash");
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect(page.getByText("Hello, I need help with a wash")).toBeVisible({ timeout: 10000 });
  });

  test("Back arrow returns from the chat thread to the FAQ/chat launcher view", async ({ page }) => {
    await page.getByRole("button", { name: /Start Live Chat|Resume Support Chat/ }).click();
    await expect(page.getByText("Live Chat Support")).toBeVisible();
    // The chat header's back button is the first button in the header row.
    await page.locator("div.border-b button").first().click();
    await expect(page.getByRole("heading", { name: "Frequently Asked Questions" })).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { API_BASE_URL } from "../../playwright.config";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

// Support asks first what the problem is about — a specific booking or a
// general topic — and keeps a separate conversation for each.
test.describe("Help & Support", () => {
  test("help with a specific booking: pick it, chat about it, see it listed", async ({ page }) => {
    const phone = await loginCustomerUI(page);
    // A booking to ask about.
    const login = await page.request.post(`${API_BASE_URL}/auth/verify-otp`, { data: { phone, code: "123456" } });
    const token = (await login.json()).data.token as string;
    await page.request.post(`${API_BASE_URL}/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        vehicleType: "hatchback",
        vehicleName: "Support Car",
        packageId: "express",
        date: new Date(Date.now() + 2 * 864e5).toISOString(),
        slot: "11:00 AM",
        addressLabel: "Home",
        addressLine: "1 Help Street",
      },
    });

    await page.goto("/app/help");
    await expect(page.locator("h1")).toHaveText("Help & Support");
    await page.getByTestId("support-topic-booking").click();
    await expect(page.locator("h1")).toHaveText("Which booking is it about?");
    await page.getByTestId("support-job-picker").getByRole("button", { name: /Support Car/ }).click();

    // The chat knows which booking it's about.
    await expect(page.getByText(/This chat is about your .* Support can see its details\./)).toBeVisible();
    const text = `Cleaner hasn't arrived ${Date.now()}`;
    await page.getByRole("textbox", { name: "Message" }).fill(text);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(text)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Your conversations" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Support Car/ })).toBeVisible();
  });

  test("a general topic opens its own chat, which can be ended and reopened", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/help");
    await page.getByTestId("support-topic-payment").click();
    await expect(page.getByText("Payments & refunds").first()).toBeVisible();

    const send = page.getByRole("button", { name: "Send" });
    await expect(send).toBeDisabled();
    await page.getByRole("textbox", { name: "Message" }).fill("Where is my refund?");
    await send.click();
    await expect(page.getByText("Where is my refund?")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "End chat" }).click();
    await page.getByRole("button", { name: "End chat" }).last().click();
    await expect(page.getByText("This conversation is closed.")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Reopen" }).click();
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible({ timeout: 10_000 });
  });
});

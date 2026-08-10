import { test, expect } from "@playwright/test";
import { loginAdminUI } from "../../fixtures/ui-helpers";
import { authHeader, uniqueName } from "../../fixtures/api-client";
import { apiContext, loginAsFreshCustomer, setCustomerName } from "../../fixtures/admin-e2e-config-helpers";
import { API_BASE_URL } from "../../playwright.config";

test.describe("Admin live chat support", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminUI(page);
    await page.goto("/admin/support");
    await expect(page.locator("h1")).toHaveText("Support Live Chat");
  });

  test("reply to a seeded customer ticket and close it", async ({ page }) => {
    // Seed a ticket + first message directly via the API, as a fresh
    // customer — using a dedicated API-bound request context (no baseURL —
    // see admin-e2e-config-helpers.ts for why every call must use a full
    // absolute URL, not a relative path).
    const api = await apiContext();
    const { token: customerToken } = await loginAsFreshCustomer(api);
    const customerName = uniqueName("Chat Customer");
    await setCustomerName(api, customerToken, customerName);

    const ticketRes = await api.post(`${API_BASE_URL}/chat/tickets`, {
      headers: authHeader(customerToken),
      data: {},
    });
    expect(ticketRes.ok()).toBeTruthy();
    const ticketBody = (await ticketRes.json()) as { data: { id: string; _id?: string } };
    const ticketId = ticketBody.data.id ?? ticketBody.data._id;

    const initialText = "Hi, I need help with my last booking.";
    const msgRes = await api.post(`${API_BASE_URL}/chat/tickets/${ticketId}/messages`, {
      headers: authHeader(customerToken),
      data: { text: initialText },
    });
    expect(msgRes.ok()).toBeTruthy();
    await api.dispose();

    // The ticket queue was already fetched once by `beforeEach`'s page load
    // (before this ticket existed) — reload so it shows up without relying
    // on the socket.io "ticket_update" push arriving in time.
    await page.reload();
    await expect(page.locator("h1")).toHaveText("Support Live Chat");

    // Admin: open queue should already be selected by default.
    await expect(page.getByRole("button", { name: "Open Queue" })).toBeVisible();

    const ticketRow = page.getByRole("button").filter({ hasText: customerName });
    await expect(ticketRow).toBeVisible();

    const messagesResponse = page.waitForResponse(
      (res) => res.url().includes(`/chat/tickets/${ticketId}/messages`) && res.request().method() === "GET",
    );
    await ticketRow.click();
    await messagesResponse;
    await expect(page.getByText(initialText)).toBeVisible();

    // Reply.
    const replyText = `Thanks for reaching out — looking into it now. ${Date.now()}`;
    const replyInput = page.getByPlaceholder("Type your response here...");
    await replyInput.fill(replyText);
    const sendButton = replyInput.locator("xpath=following-sibling::button");

    const sendResponse = page.waitForResponse(
      (res) => res.url().includes(`/chat/tickets/${ticketId}/messages`) && res.request().method() === "POST",
    );
    await sendButton.click();
    await sendResponse;
    await expect(page.getByText(replyText)).toBeVisible();

    // Close the ticket.
    const closeResponse = page.waitForResponse(
      (res) => res.url().includes(`/chat/tickets/${ticketId}/close`) && res.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: /Close Ticket/ }).click();
    await closeResponse;
    await expect(page.getByRole("button", { name: /Reopen Ticket/ })).toBeVisible();
    await expect(page.getByText("This ticket is closed.", { exact: false })).toBeVisible();

    // Reopen it — actually exercise PATCH /chat/tickets/:id/reopen, not just
    // check the button renders.
    const reopenResponse = page.waitForResponse(
      (res) => res.url().includes(`/chat/tickets/${ticketId}/reopen`) && res.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: /Reopen Ticket/ }).click();
    await reopenResponse;
    await expect(page.getByRole("button", { name: /Close Ticket/ })).toBeVisible();
    await expect(page.getByText("This ticket is closed.", { exact: false })).not.toBeVisible();
  });

  test("support status segmented control switches auto/online/offline", async ({ page }) => {
    const forceOnline = page.getByRole("button", { name: "Force Online" });
    const forceOffline = page.getByRole("button", { name: "Force Offline" });
    const auto = page.getByRole("button", { name: /^Auto \(/ });

    const onlineResponse = page.waitForResponse(
      (res) => res.url().includes("/chat/config") && res.request().method() === "PATCH",
    );
    await forceOnline.click();
    const onlineRes = await onlineResponse;
    expect(onlineRes.ok()).toBeTruthy();
    await expect(forceOnline).toHaveClass(/bg-green-500/);

    const offlineResponse = page.waitForResponse(
      (res) => res.url().includes("/chat/config") && res.request().method() === "PATCH",
    );
    await forceOffline.click();
    const offlineRes = await offlineResponse;
    expect(offlineRes.ok()).toBeTruthy();
    await expect(forceOffline).toHaveClass(/bg-red-500/);

    const autoResponse = page.waitForResponse(
      (res) => res.url().includes("/chat/config") && res.request().method() === "PATCH",
    );
    await auto.click();
    const autoRes = await autoResponse;
    expect(autoRes.ok()).toBeTruthy();
    await expect(auto).toHaveClass(/bg-primary/);
  });
});

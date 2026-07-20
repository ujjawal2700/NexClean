import { test, expect } from "@playwright/test";
import { SEED_AGENT_PHONE } from "../../fixtures/api-client";
import { loginAgentUI } from "../../fixtures/ui-helpers";
import { autoAcceptNextDialog } from "../../fixtures/ui-helpers";

/**
 * /agent/help reuses the customer module's chat hooks (useCreateTicket / useSendMessage /
 * useCloseTicket -> POST /chat/tickets, POST /chat/tickets/:id/messages, PATCH
 * /chat/tickets/:id/close) via useActiveToken, which resolves to the agent's own
 * token when the path starts with /agent. See frontend/src/modules/agent/pages/HelpSupport.tsx
 * and frontend/src/modules/customer/api/{queries,mutations}.ts.
 */
test.describe("Agent Help & Support", () => {
  test("loads the FAQ/chat trigger screen", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/help");
    await expect(page.locator("h1")).toHaveText("Help & Support");
    await expect(page.getByText("Live Support Chat")).toBeVisible();
    // Either "Start a chat" (no open ticket) or "Resume chat" (one already open from a prior run).
    await expect(page.getByRole("button", { name: /Start a chat|Resume chat/ })).toBeVisible();
  });

  test("starting a chat opens a ticket and the chat workspace", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/help");

    const trigger = page.getByRole("button", { name: /Start a chat|Resume chat/ });
    const wasFreshTicket = (await trigger.textContent())?.includes("Start a chat");

    const createTicketResponse = wasFreshTicket
      ? page.waitForResponse((res) => res.url().includes("/chat/tickets") && res.request().method() === "POST")
      : null;
    await trigger.click();
    if (createTicketResponse) await createTicketResponse;

    await expect(page.getByText("Live Chat Support")).toBeVisible();
    await expect(page.getByRole("button", { name: "Close Ticket" })).toBeVisible();
  });

  test("sending a message posts it and renders it in the thread; empty input can't be sent", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/help");
    await page.getByRole("button", { name: /Start a chat|Resume chat/ }).click();
    await expect(page.getByText("Live Chat Support")).toBeVisible();

    const messageInput = page.getByPlaceholder("Type your message here...");
    const sendButton = page.locator('form button[type="submit"]');

    // Can't send an empty/whitespace-only message.
    await expect(sendButton).toBeDisabled();
    await messageInput.fill("   ");
    await expect(sendButton).toBeDisabled();

    const text = `Hello from the agent app E2E test ${Date.now()}`;
    await messageInput.fill(text);
    await expect(sendButton).toBeEnabled();

    const sendResponse = page.waitForResponse(
      (res) => /\/chat\/tickets\/.+\/messages$/.test(res.url()) && res.request().method() === "POST",
    );
    await sendButton.click();
    await sendResponse;

    await expect(page.getByText(text)).toBeVisible();
    // Input clears after sending.
    await expect(messageInput).toHaveValue("");
  });

  test("'Close Ticket' asks for confirmation and returns to the trigger screen", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/help");
    await page.getByRole("button", { name: /Start a chat|Resume chat/ }).click();
    await expect(page.getByText("Live Chat Support")).toBeVisible();

    autoAcceptNextDialog(page);
    await page.getByRole("button", { name: "Close Ticket" }).click();

    // Closing the ticket exits the chat workspace back to the FAQ/trigger screen,
    // and since the ticket is now closed, the CTA reverts to "Start a chat".
    await expect(page.getByRole("button", { name: "Start a chat" })).toBeVisible();
    await expect(page.getByText("Live Support Chat")).toBeVisible();
  });
});

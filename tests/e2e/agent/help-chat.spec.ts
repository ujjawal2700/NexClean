import { test, expect, seedAssignedJob, SEED_AGENT_PHONE } from "../../fixtures/agent-e2e-helpers";
import { loginAgentUI } from "../../fixtures/ui-helpers";

// The cleaner app shares the customer's Support Center: pick a job (or topic)
// first, then chat — support sees which job it's about.
test.describe("Agent Help & Support", () => {
  test("shows the topic picker", async ({ page }) => {
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/help");
    await expect(page.locator("h1")).toHaveText("Help & Support");
    await expect(page.getByTestId("support-topic-booking")).toContainText("A specific job");
    await expect(page.getByTestId("support-topic-app")).toBeVisible();
  });

  test("help with a job: pick it, then send a message about it", async ({ page, request }) => {
    test.setTimeout(90_000);
    await seedAssignedJob(request);
    await loginAgentUI(page, SEED_AGENT_PHONE);
    await page.goto("/agent/help");
    await page.getByTestId("support-topic-booking").click();
    await expect(page.locator("h1")).toHaveText("Which job is it about?");
    await page.getByTestId("support-job-picker").getByRole("button").first().click();

    await expect(page.getByText(/This chat is about your .* Support can see its details\./)).toBeVisible();
    const text = `Gate is locked at the society ${Date.now()}`;
    await page.getByRole("textbox", { name: "Message" }).fill(text);
    const sent = page.waitForResponse((r) => /\/chat\/tickets\/.+\/messages$/.test(r.url()) && r.request().method() === "POST");
    await page.getByRole("button", { name: "Send" }).click();
    await sent;
    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("");
  });
});

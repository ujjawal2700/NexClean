import { test, expect } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

// iOS only allows web push for a site opened from the Home Screen, so an
// iPhone in a Safari tab gets instructions instead of a dead "Turn on" button.
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

test.describe("Push notifications on iPhone", () => {
  test.describe("in a Safari tab", () => {
    test.use({ userAgent: IPHONE_SAFARI, viewport: { width: 390, height: 844 } });

    test("shows Add to Home Screen instructions", async ({ page }) => {
      await loginCustomerUI(page);
      await page.goto("/app/notifications");
      const hint = page.getByTestId("ios-push-hint");
      await expect(hint).toBeVisible();
      await expect(hint).toContainText("Add to Home Screen");
    });
  });

  test("a desktop browser doesn't see the iPhone instructions", async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto("/app/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByTestId("ios-push-hint")).toHaveCount(0);
  });
});

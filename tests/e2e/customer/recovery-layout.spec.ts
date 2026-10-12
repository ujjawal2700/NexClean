import { test, expect } from "@playwright/test";

const channels = [
  { type: "phone", label: "Support phone", value: "+91 90000 00123", href: "tel:+919000000123" },
  { type: "email", label: "Support email", value: "care@nexclean.example", href: "mailto:care@nexclean.example" },
  { type: "address", label: "Office", value: "Published operations office", href: "" },
];

for (const role of ["app", "agent"]) {
  for (const reason of ["deactivated", "missing"]) {
    test(`${role} ${reason} recovery remains usable on a short phone`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 480 });
      await page.addInitScript(() => localStorage.setItem("nexclean-cookie-consent", JSON.stringify({ version: 1, necessary: true, functional: false })));
      await page.route("**/api/**", route => {
        const path = new URL(route.request().url()).pathname;
        if (!path.startsWith("/api/")) return route.continue();
        if (path.includes("send-login-otp")) return route.fulfill({ status: reason === "missing" ? 404 : 403, json: { success: false, message: reason === "missing" ? "NOT_REGISTERED: This number is not registered" : "ACCOUNT_DEACTIVATED: Your account has been deactivated" } });
        return route.fulfill({ json: { success: true, data: path === "/api/catalog/content" ? { contact: { channels } } : {} } });
      });
      await page.goto(`/${role}/login`);
      await page.locator('input[name="phone"]').fill("9876543210");
      await page.getByRole("button", { name: "Send OTP", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: reason === "missing" ? "Your account was not found" : "Account Deactivated" });
      await expect(dialog).toBeVisible();
      const button = reason === "missing" ? dialog.getByRole("button", { name: "Use another number", exact: true }) : dialog.getByRole("button", { name: "Close", exact: true });
      await expect(button).toBeInViewport();
      const box = (await button.boundingBox())!;
      expect(480 - box.y - box.height).toBeGreaterThanOrEqual(48);
      if (reason === "deactivated") {
        await expect(dialog.getByRole("link", { name: "Call Support", exact: true })).toHaveAttribute("href", "tel:+919000000123");
        await expect(dialog).not.toContainText("HSR Layout");
        await page.keyboard.press("Escape");
      } else await button.click();
      await expect(dialog).toHaveCount(0);
    });
  }
}

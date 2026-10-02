import { test, expect } from "@playwright/test";
import { API_BASE_URL } from "../../playwright.config";
import { LEGAL_ACCEPTANCE, freshPhone } from "../../fixtures/api-client";

// A shared invite (https://nexclean.in/referral?code=CODE) — opened in a
// browser, i.e. without the app — lands on sign-up with the code applied and
// verified. With the app installed, the same URL opens the app instead.
async function referrerCode(page: import("@playwright/test").Page): Promise<string> {
  const phone = freshPhone();
  await page.request.post(`${API_BASE_URL}/auth/customer/signup`, {
    data: { name: "Aisha Khan", phone, ...LEGAL_ACCEPTANCE },
  });
  const login = await page.request.post(`${API_BASE_URL}/auth/verify-otp`, { data: { phone, code: "123456" } });
  const token = (await login.json()).data.token as string;
  const summary = await page.request.get(`${API_BASE_URL}/users/me/referrals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await summary.json()).data.referralCode as string;
}

test.describe("Referral invite link", () => {
  for (const shape of ["query", "path"] as const) {
    test(`/referral${shape === "query" ? "?code=" : "/"}CODE opens sign-up with the code verified`, async ({ page }) => {
      const code = await referrerCode(page);
      await page.context().clearCookies();
      await page.goto(shape === "query" ? `/referral?code=${code.toLowerCase()}` : `/referral/${code}`);
      await expect(page).toHaveURL(new RegExp(`/app/signup\\?ref=${code}$`));
      await expect(page.locator('input[name="referralCode"]')).toHaveValue(code);
      await expect(page.getByText("Referred by Aisha K.")).toBeVisible({ timeout: 15_000 });
    });
  }

  test("the deep-link verification files are served as JSON", async ({ request }) => {
    for (const path of ["/.well-known/assetlinks.json", "/.well-known/apple-app-site-association"]) {
      const res = await request.get(path);
      expect(res.ok(), path).toBeTruthy();
      const body = JSON.parse(await res.text());
      expect(JSON.stringify(body)).toContain("com.nexclean.customer");
    }
  });
});

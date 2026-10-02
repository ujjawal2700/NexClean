import { test, expect } from "@playwright/test";
import { API_BASE_URL } from "../../playwright.config";
import { LEGAL_ACCEPTANCE, freshPhone } from "../../fixtures/api-client";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

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

// Inside the Flutter app's web view there is no navigator.share and the
// Clipboard API is often blocked; Share must still get the invite out.
test.describe("Refer & Earn share inside the app's web view", () => {
  test("with no share sheet or clipboard API, the invite link is copied and confirmed", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      (window as unknown as { __copied: string[] }).__copied = [];
      const original = document.execCommand.bind(document);
      document.execCommand = (cmd: string, ...rest: unknown[]) => {
        if (cmd === "copy") {
          const el = document.activeElement as HTMLTextAreaElement | null;
          (window as unknown as { __copied: string[] }).__copied.push(el?.value ?? "");
          return true;
        }
        return original(cmd, ...(rest as []));
      };
    });
    await loginCustomerUI(page);
    await page.goto("/app/profile/refer");
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByText("Invite link copied")).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.join("\n"));
    expect(copied).toMatch(/https:\/\/nexclean\.in\/referral\?code=[A-Z0-9]+/);
  });

  test("hands the invite to the app's native share sheet when the app provides the bridge", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __shared: string[] }).__shared = [];
      (window as unknown as { NexCleanShare: { postMessage: (m: string) => void } }).NexCleanShare = {
        postMessage: (m) => (window as unknown as { __shared: string[] }).__shared.push(m),
      };
    });
    await loginCustomerUI(page);
    await page.goto("/app/profile/refer");
    await page.getByRole("button", { name: "Share" }).click();
    const shared = await page.evaluate(() => (window as unknown as { __shared: string[] }).__shared);
    expect(shared).toHaveLength(1);
    const payload = JSON.parse(shared[0]);
    expect(payload.url).toMatch(/^https:\/\/nexclean\.in\/referral\?code=[A-Z0-9]+$/);
    expect(payload.text).toContain("referral code");
  });
});

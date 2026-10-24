import { test, expect, type Page } from "@playwright/test";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 22.7196, longitude: 75.8577 } });

async function setup(page: Page, options: { nativeToken?: string; failFirst?: boolean; webView?: boolean } = {}) {
  await page.context().grantPermissions(["geolocation"]);
  await page.addInitScript(({ nativeToken, webView }) => {
    localStorage.setItem("nexclean-agent-session", JSON.stringify({ state: { authenticated: true }, version: 0 }));
    localStorage.setItem("nexclean-cookie-consent", JSON.stringify({ version: 1, necessary: true, functional: false }));
    if (nativeToken) localStorage.setItem("nexclean-native-push-token", nativeToken);
    if (webView) Object.defineProperty(window, "Notification", { value: undefined, configurable: true });
    // Model permission independently of the headless browser/host OS policy.
    else Object.defineProperty(Notification, "permission", { get: () => "granted", configurable: true });
  }, options);
  const registrations: string[] = [];
  let pushReady = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    let data: unknown = [];
    if (path === "/api/notifications/register-token") {
      registrations.push(route.request().postDataJSON().token);
      if (options.failFirst && registrations.length === 1) {
        await route.fulfill({ status: 503, json: { success: false, message: "Temporary outage" } });
        return;
      }
      pushReady = true;
      data = { registered: true };
    } else if (path === "/api/auth/me") {
      data = { id: "agent-test", role: "agent", agentStatus: "verified", name: "Test Agent", phone: "9999999999", city: "Indore", area: "Indore", rating: 5, jobsDone: 0, online: true, pushReady };
    } else if (path === "/api/config/public") data = { firebase: { apiKey: "test", projectId: "test", messagingSenderId: "test", appId: "test", vapidKey: "" } };
    else if (path === "/api/agent/offers/current") data = null;
    await route.fulfill({ json: { success: true, data } });
  });
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    ws.send('0{"sid":"test","upgrades":[],"pingInterval":25000,"pingTimeout":20000}');
    ws.onMessage((message) => { if (String(message).startsWith("40")) ws.send('40{"sid":"agent-test"}'); });
  });
  await page.goto("/agent/notifications");
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
  return registrations;
}

test("granted browser permission without a token does not claim background push is enabled", async ({ page }) => {
  const registrations = await setup(page);
  expect(await page.evaluate(() => ({
    permission: Notification.permission,
    serviceWorker: "serviceWorker" in navigator,
    secure: window.isSecureContext,
  }))).toEqual({ permission: "granted", serviceWorker: true, secure: true });
  await expect(page.getByTestId("push-enabled")).toHaveCount(0);
  await page.getByTestId("enable-push").click();
  await expect(page.getByTestId("push-enable-error")).toContainText("Background alerts could not be registered");
  expect(registrations).toEqual([]);
});

test("the Android native bridge registers push without a browser Notification API", async ({ page }) => {
  const registrations = await setup(page, { webView: true });
  await expect(page.getByText("Background job alerts are not set up for this app.", { exact: false })).toBeVisible();
  const result = await page.evaluate(() => (window as any).registerNativePushToken("native-android-fcm-token"));
  expect(result).toBe(true);
  await expect(page.getByTestId("push-enabled")).toBeVisible();
  expect(registrations).toContain("native-android-fcm-token");
});

test("failed automatic registration retries when the network returns", async ({ page }) => {
  const registrations = await setup(page, { nativeToken: "native-android-retry-token", failFirst: true });
  await expect.poll(() => registrations.length).toBe(1);
  await expect(page.getByTestId("push-enabled")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("push-enabled")).toBeVisible();
  expect(registrations).toEqual(["native-android-retry-token", "native-android-retry-token"]);
});

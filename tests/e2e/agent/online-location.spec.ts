import { test, expect, type Page } from "@playwright/test";

async function setup(page: Page, denyLocation = false, pendingVerification = false) {
  await page.addInitScript(({ denied }) => {
    localStorage.setItem("nexclean-agent-session", JSON.stringify({ state: { authenticated: true }, version: 0 }));
    localStorage.setItem("nexclean-cookie-consent", JSON.stringify({ version: 1, necessary: true, functional: false }));
    const fixes: PositionCallback[] = [];
    const position = { coords: { latitude: 22.7196, longitude: 75.8577, heading: null, speed: null }, timestamp: Date.now() } as GeolocationPosition;
    Object.defineProperty(navigator, "geolocation", { value: {
      getCurrentPosition: (success: PositionCallback, failure: PositionErrorCallback) => {
        if (denied) failure({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
        else fixes.push(success); // Simulate a permission dialog left unanswered.
      },
      watchPosition: (success: PositionCallback, failure: PositionErrorCallback) => {
        if (denied) failure({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
        fixes.push(success);
        return 1;
      },
      clearWatch: () => {},
    } });
    (window as any).allowTestLocation = () => {
      denied = false;
      fixes.forEach((fn) => fn(position));
    };
  }, { denied: denyLocation });
  let online = false;
  let agentStatus = pendingVerification ? "pending" : "verified";
  const changes: boolean[] = [];
  const coordinates: Array<{ lat: number; lng: number }> = [];
  let releaseOnline: (() => void) | undefined;
  let hold = false;
  const profile = () => ({ id: "agent-test", role: "agent", agentStatus, name: "Indore Cleaner", phone: "9999999999", city: "Indore", area: "Indore", rating: 5, jobsDone: 0, pushReady: false, online });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (path === "/api/agent/online") {
      const body = route.request().postDataJSON();
      changes.push(body.online);
      if (hold) await new Promise<void>((resolve) => { releaseOnline = resolve; });
      online = body.online;
    }
    if (path === "/api/agent/heartbeat") {
      const body = route.request().postDataJSON();
      if (body?.lat != null) coordinates.push(body);
    }
    const data = ["/api/auth/me", "/api/agent/online", "/api/agent/heartbeat"].includes(path) ? profile()
      : path === "/api/agent/summary" ? { jobsToday: 0, completedToday: 0, earnedToday: 0, potentialToday: 0 }
      : path === "/api/agent/offers/current" ? null : path === "/api/config/public" ? {} : [];
    await route.fulfill({ json: { success: true, data } });
  });
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    ws.send('0{"sid":"test","upgrades":[],"pingInterval":25000,"pingTimeout":20000}');
    ws.onMessage((message) => {
      if (String(message).startsWith("40")) ws.send('40{"sid":"agent-test"}');
    });
  });
  await page.goto("/agent");
  if (pendingVerification) await expect(page.getByRole("heading", { name: "Application under review" })).toBeVisible();
  else await expect(page.getByTestId("duty-switch")).toBeVisible();
  return { verify: () => { agentStatus = "verified"; }, changes, coordinates, hold: () => { hold = true; }, release: () => releaseOnline?.() };
}

test("online updates without waiting for GPS; every switch locks immediately", async ({ page }) => {
  const api = await setup(page);
  api.hold();
  await page.getByTestId("duty-switch").click();
  await expect(page.getByTestId("duty-switch")).toBeDisabled();
  await expect(page.getByTestId("online-toggle")).toBeDisabled();
  await expect(page.getByTestId("duty-switch")).toContainText("Updating");
  // Programmatic repeated taps also exercise the synchronous shared lock.
  await page.getByTestId("online-toggle").evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => api.changes).toEqual([true]);
  api.release();
  await expect(page.getByTestId("duty-switch")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("duty-switch")).toBeEnabled();
  await expect(page.getByTestId("enable-agent-location")).toContainText("Getting location");
  await page.getByTestId("duty-switch").click();
  await expect.poll(() => api.changes).toEqual([true, false]);
  api.release();
  await expect(page.getByTestId("duty-switch")).toHaveAttribute("aria-checked", "false");
  // A late location callback must never switch availability back on.
  await page.evaluate(() => (window as any).allowTestLocation());
  await expect(page.getByTestId("duty-switch")).toHaveAttribute("aria-checked", "false");
  expect(api.changes).toEqual([true, false]);
});

test("blocked location explains settings and offers an explicit retry", async ({ page }) => {
  await setup(page, true);
  await page.getByTestId("duty-switch").click();
  await expect(page.getByTestId("duty-switch")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/Enable location for this site in your browser or app settings/)).toBeVisible();
  await expect(page.getByTestId("enable-agent-location")).toBeEnabled();
  await page.getByTestId("enable-agent-location").click();
  await expect(page.getByText(/Enable location for this site in your browser or app settings/)).toBeVisible();
});

test("allowing location sends Indore coordinates and clears the location prompt", async ({ page }) => {
  const api = await setup(page);
  await page.getByTestId("duty-switch").click();
  await expect(page.getByTestId("enable-agent-location")).toBeVisible();
  await page.evaluate(() => (window as any).allowTestLocation());
  await expect.poll(() => api.coordinates.some((fix) => fix.lat === 22.7196 && fix.lng === 75.8577)).toBeTruthy();
  await expect(page.getByTestId("enable-agent-location")).toHaveCount(0);
});


test("admin approval unlocks a newly signed-up agent without a reload", async ({ page }) => {
  const api = await setup(page, false, true);
  api.verify();
  await expect(page.getByTestId("duty-switch")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Application under review" })).toHaveCount(0);
});

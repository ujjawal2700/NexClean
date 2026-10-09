import { test, expect, type Page } from "@playwright/test";

async function setup(page: Page, denyLocation = false, pendingVerification = false, allowImmediately = false) {
  await page.addInitScript(({ denied, immediate }) => {
    localStorage.setItem("nexclean-agent-session", JSON.stringify({ state: { authenticated: true }, version: 0 }));
    localStorage.setItem("nexclean-cookie-consent", JSON.stringify({ version: 1, necessary: true, functional: false }));
    const fixes: PositionCallback[] = [];
    const position = { coords: { latitude: 22.7196, longitude: 75.8577, heading: null, speed: null }, timestamp: Date.now() } as GeolocationPosition;
    Object.defineProperty(navigator, "geolocation", { value: {
      getCurrentPosition: (success: PositionCallback, failure: PositionErrorCallback) => {
        if (denied) failure({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
        else if (immediate) success(position);
        else fixes.push(success); // Simulate a permission dialog left unanswered.
      },
      watchPosition: (success: PositionCallback, failure: PositionErrorCallback) => {
        if (denied) failure({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
        fixes.push(success);
        if (!denied && immediate) success(position);
        return 1;
      },
      clearWatch: () => {},
    } });
    (window as any).allowTestLocation = () => {
      denied = false;
      fixes.forEach((fn) => fn(position));
    };
  }, { denied: denyLocation, immediate: allowImmediately });
  let online = false;
  let agentStatus = pendingVerification ? "pending" : "verified";
  const changes: boolean[] = [];
  const coordinates: Array<{ lat: number; lng: number }> = [];
  const profile = () => ({ id: "agent-test", role: "agent", agentStatus, name: "Indore Cleaner", phone: "9999999999", city: "Indore", area: "Indore", rating: 5, jobsDone: 0, pushReady: false, online });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (path === "/api/agent/online") {
      const body = route.request().postDataJSON();
      changes.push(body.online);
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
  if (!allowImmediately) await expect(page.getByTestId("agent-location-gate")).toBeVisible();
  else if (pendingVerification) await expect(page.getByRole("heading", { name: "Application under review" })).toBeVisible();
  else await expect(page.getByTestId("duty-switch")).toBeVisible();
  return { verify: () => { agentStatus = "verified"; }, changes, coordinates };
}

test("location is required before accessing the dashboard or a direct job link", async ({ page }) => {
  const api = await setup(page);
  await expect(page.getByRole("heading", { name: "Location access required" })).toBeVisible();
  await expect(page.getByTestId("duty-switch")).toHaveCount(0);
  await page.goto("/agent/jobs");
  await expect(page.getByTestId("agent-location-gate")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jobs", exact: true })).toHaveCount(0);
  expect(api.changes).toEqual([]);
});

test("denied location blocks the app and offers settings guidance and retry", async ({ page }) => {
  const api = await setup(page, true);
  await expect(page.getByText(/Enable location for this site in your browser or app settings/)).toBeVisible();
  await page.getByRole("button", { name: "Enable location", exact: true }).click();
  await expect(page.getByTestId("agent-location-gate")).toBeVisible();
  await expect(page.getByTestId("duty-switch")).toHaveCount(0);
  expect(api.changes).toEqual([]);
});

test("allowing location unlocks the app and online sends current coordinates", async ({ page }) => {
  const api = await setup(page);
  await page.evaluate(() => (window as any).allowTestLocation());
  await expect(page.getByTestId("agent-location-gate")).toHaveCount(0);
  await expect(page.getByTestId("duty-switch")).toBeVisible();
  // A new request still needs a fix; it cannot reuse permission alone.
  await page.getByTestId("duty-switch").click();
  expect(api.changes).toEqual([]);
  await page.evaluate(() => (window as any).allowTestLocation());
  await expect.poll(() => api.changes).toEqual([true]);
  await expect.poll(() => api.coordinates.some((fix) => fix.lat === 22.7196 && fix.lng === 75.8577)).toBeTruthy();
});

test("revoking location blocks an open page and takes an online agent offline", async ({ page, context }) => {
  const api = await setup(page, false, false, true);
  await page.getByTestId("duty-switch").click();
  await expect.poll(() => api.changes).toEqual([true]);
  await expect(page.getByTestId("duty-switch")).toHaveAttribute("aria-checked", "true");
  await context.clearPermissions();
  await expect(page.getByTestId("agent-location-gate")).toBeVisible();
  await expect(page.getByTestId("duty-switch")).toHaveCount(0);
  await expect.poll(() => api.changes).toEqual([true, false]);
  await context.grantPermissions(["geolocation"]);
  await expect(page.getByTestId("agent-location-gate")).toHaveCount(0);
  await expect(page.getByTestId("duty-switch")).toHaveAttribute("aria-checked", "false");
});

test("an agent can log out while location is blocked", async ({ page }) => {
  await setup(page, true);
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/agent\/login$/);
});


test("admin approval unlocks a newly signed-up agent without a reload", async ({ page }) => {
  const api = await setup(page, false, true, true);
  api.verify();
  await expect(page.getByTestId("duty-switch")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Application under review" })).toHaveCount(0);
});

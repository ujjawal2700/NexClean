import { defineConfig, devices } from "@playwright/test";

/**
 * Base URLs default to the dedicated TEST ports run-all.sh starts (backend
 * :4400, frontend :5190) — never the dev defaults (:4000/:5173), where
 * `npm run dev` may be running against the production database from
 * backend/.env. Pointing tests at 4000 once wrote test data into production.
 * Override via env vars to point at a staging environment if one exists.
 */
export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4400/api";
export const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "http://localhost:5190";

export default defineConfig({
  testDir: ".",
  fullyParallel: false, // most tests create real records against a shared dev DB
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  },
  projects: [
    {
      name: "unit",
      testDir: "./unit",
    },
    {
      name: "api",
      testDir: "./api",
      use: { baseURL: API_BASE_URL },
    },
    {
      name: "landing-e2e",
      testDir: "./e2e/landing",
      use: { viewport: { width: 1280, height: 720 }, baseURL: WEB_BASE_URL },
    },
    {
      name: "customer-e2e",
      testDir: "./e2e/customer",
      use: { viewport: { width: 1280, height: 720 }, baseURL: WEB_BASE_URL },
    },
    {
      name: "agent-e2e",
      testDir: "./e2e/agent",
      use: { viewport: { width: 1280, height: 720 }, baseURL: WEB_BASE_URL,
        permissions: ["geolocation"], geolocation: { latitude: 22.7196, longitude: 75.8577 } },
    },
    {
      name: "admin-e2e",
      testDir: "./e2e/admin",
      use: { viewport: { width: 1280, height: 720 }, baseURL: WEB_BASE_URL },
    },
  ],
});

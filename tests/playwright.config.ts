import { defineConfig, devices } from "@playwright/test";

/**
 * Base URLs default to a local dev stack (backend on :4000, frontend on
 * :5173) so the suite never writes test data into the production database.
 * Override via env vars to point at a staging environment if one exists.
 */
export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api";
export const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "http://localhost:5173";

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
      use: { viewport: { width: 1280, height: 720 }, baseURL: WEB_BASE_URL },
    },
    {
      name: "admin-e2e",
      testDir: "./e2e/admin",
      use: { viewport: { width: 1280, height: 720 }, baseURL: WEB_BASE_URL },
    },
  ],
});

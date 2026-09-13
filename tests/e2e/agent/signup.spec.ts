import { test, expect, type APIRequestContext } from "@playwright/test";
import { DEMO_OTP, freshPhone, loginByPhone, authHeader } from "../../fixtures/api-client";
import { tinyPngFile } from "../../fixtures/agent-e2e-helpers";
import { apiUrl, loginAsAdminApi } from "../../fixtures/admin-api-helpers";

/** The city/area the signup form should offer. Seeded so the picker is deterministic. */
const TEST_CITY = "Indore";
const TEST_AREA = "Green Valley Society";

/**
 * Make sure the admin Locations list has a city and area to choose from.
 *
 * Signup no longer takes free text — it offers the admin-managed list, and
 * falls back to a text box only when no cities exist at all. Seeding here keeps
 * the form in one predictable shape regardless of what other specs have created.
 */
async function seedLocation(request: APIRequestContext) {
  const { token } = await loginAsAdminApi(request);
  const cities = (await (await request.get(apiUrl("/admin/cities"), { headers: authHeader(token) })).json()).data as
    { id: string; name: string }[];
  let city = cities.find((c) => c.name === TEST_CITY);
  if (!city) {
    const res = await request.post(apiUrl("/admin/cities"), { headers: authHeader(token), data: { name: TEST_CITY } });
    city = (await res.json()).data as { id: string; name: string };
  }

  const zones = (await (await request.get(apiUrl("/admin/zones"), { headers: authHeader(token) })).json()).data as
    { name: string; cityName: string }[];
  if (!zones.some((z) => z.name === TEST_AREA && z.cityName === TEST_CITY)) {
    // A zone is now a real geofence — boundary is required, not optional
    // (see backend/src/modules/location/location.model.ts). Any small
    // triangle works here; this zone's shape doesn't matter to this spec.
    await request.post(apiUrl("/admin/zones"), {
      headers: authHeader(token),
      data: {
        name: TEST_AREA,
        cityId: city.id,
        coordinates: [
          [75.85, 22.71],
          [75.86, 22.71],
          [75.86, 22.72],
        ],
      },
    });
  }
}

async function fillDetails(page: import("@playwright/test").Page, opts: { name: string; phone: string; area: string }) {
  await page.locator('input[name="name"]').fill(opts.name);
  await page.locator('input[name="phone"]').fill(opts.phone);
  await page.locator('select[name="city"]').selectOption(TEST_CITY);
  await page.locator('select[name="area"]').selectOption(opts.area);
}

/**
 * Click Continue on the details step and wait for the OTP actually to be sent.
 *
 * The step only advances after `sendSignupOtp` resolves, so asserting the next
 * heading on the default 5s timeout races the request — that made the two
 * signup tests intermittently fail with the page still on "Join as a cleaner"
 * and no error shown. Waiting on the response removes the guesswork.
 */
async function continueToOtp(page: import("@playwright/test").Page) {
  const sent = page.waitForResponse(
    (r) => r.url().includes("/auth/send-signup-otp") && r.request().method() === "POST",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await sent;
  await expect(page.locator("h1")).toHaveText("Verify your number", { timeout: 15_000 });
}

async function passOtpStep(page: import("@playwright/test").Page) {
  await expect(page.locator("h1")).toHaveText("Verify your number", { timeout: 15_000 });
  await page.locator('input[name="otp"]').fill(DEMO_OTP);
  await page.getByRole("button", { name: "Verify & continue" }).click();
}

test.describe("Agent signup", () => {
  test.beforeEach(async ({ request }) => {
    await seedLocation(request);
  });

  test("details step: validates name, phone and area before proceeding", async ({ page }) => {
    await page.goto("/agent/signup");
    await expect(page.locator("h1")).toHaveText("Join as a cleaner");

    // All empty -> name error first.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter your full name")).toBeVisible();

    // Valid name, bad phone -> phone error.
    await page.locator('input[name="name"]').fill("Test Cleaner");
    await page.locator('input[name="phone"]').fill("123");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a valid 10-digit number")).toBeVisible();

    // Valid name + phone, no city chosen -> city error.
    await page.locator('input[name="phone"]').fill(freshPhone());
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose the city you'll work in")).toBeVisible();

    // The area dropdown stays locked until a city is chosen.
    const areaSelect = page.locator('select[name="area"]');
    await expect(areaSelect).toBeDisabled();

    await page.locator('select[name="city"]').selectOption(TEST_CITY);
    await expect(areaSelect).toBeEnabled();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose the area you'll operate in")).toBeVisible();

    // Still on the details step throughout.
    await expect(page.locator("h1")).toHaveText("Join as a cleaner");
  });

  test("details step: shows toast error if user already exists with phone number", async ({ page, request }) => {
    const existingPhone = freshPhone();
    await loginByPhone(request, existingPhone);

    await page.goto("/agent/signup");
    await fillDetails(page, { name: "Duplicate Cleaner", phone: existingPhone, area: "Green Valley Society" });
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("User already exists with this number")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Join as a cleaner");
  });

  test("otp step: rejects wrong OTP and supports Back to details button", async ({ page }) => {
    const phone = freshPhone();
    await page.goto("/agent/signup");
    await fillDetails(page, { name: "Test Cleaner", phone, area: "Green Valley Society" });
    await continueToOtp(page);

    // Wrong OTP code
    await page.locator('input[name="otp"]').fill("000000");
    await page.getByRole("button", { name: "Verify & continue" }).click();
    await expect(page.getByText("Incorrect code")).toBeVisible();

    // Back button returns to details step
    await page.getByRole("button", { name: "Back to details" }).click();
    await expect(page.locator("h1")).toHaveText("Join as a cleaner");
    await expect(page.locator('input[name="phone"]')).toHaveValue(phone);
  });

  test("kyc step: validates aadhar number and requires both photos", async ({ page }) => {
    const phone = freshPhone();
    await page.goto("/agent/signup");
    await fillDetails(page, { name: "Test Cleaner", phone, area: "Green Valley Society" });
    await continueToOtp(page);
    await passOtpStep(page);
    await expect(page.locator("h1")).toHaveText("Identity verification");

    // Malformed aadhar.
    await page.locator('input[name="aadhar"]').fill("123");
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByText("Aadhar number must be 12 digits")).toBeVisible();

    // Valid aadhar, but no photos uploaded yet.
    await page.locator('input[name="aadhar"]').fill("123456789012");
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByText("Upload both sides of your Aadhar card")).toBeVisible();

    // Still on the kyc step, not submitted.
    await expect(page.locator("h1")).toHaveText("Identity verification");
  });

  test("unverified agent KYC flow: redirects back to KYC step, restricts actions, and shows homepage banner", async ({ page }) => {
    const phone = freshPhone();
    
    // 1. Start signup details
    await page.goto("/agent/signup");
    await fillDetails(page, { name: "KYC Agent", phone, area: TEST_AREA });
    await continueToOtp(page);

    // 2. Verify OTP (which creates unverified agent & logs them in)
    await passOtpStep(page);
    await expect(page.locator("h1")).toHaveText("Identity verification");
    
    // 3. User closes the app/goes to home page directly (bypasses KYC)
    await page.goto("/agent");
    
    // 4. They should see the KYC Verification Required banner on the dashboard
    await expect(page.getByText("KYC Verification Required")).toBeVisible();
    
    // 5. Normal buttons like "View all jobs" must be disabled
    const viewJobsBtn = page.getByRole("button", { name: "View all jobs" });
    await expect(viewJobsBtn).toBeDisabled();
    
    // 6. Online toggle in header must be disabled
    const onlineToggle = page.getByRole("button", { name: /offline|online/i });
    await expect(onlineToggle).toBeDisabled();

    // 7. Clicking the banner "Submit KYC" should redirect them back to the KYC signup page
    await page.getByRole("link", { name: "Submit KYC" }).click();
    await page.waitForURL(/\/agent\/signup$/);
    await expect(page.locator("h1")).toHaveText("Identity verification");
    
    // 8. No back button is visible on the KYC page
    await expect(page.getByRole("button", { name: "Back", exact: true })).not.toBeVisible();
  });

  test("full happy path: details -> OTP verification -> KYC submission -> lands on pending screen", async ({ page }) => {
    const phone = freshPhone();
    await page.goto("/agent/signup");
    await fillDetails(page, { name: "Test Cleaner", phone, area: "Green Valley Society" });
    await continueToOtp(page);

    await passOtpStep(page);
    await expect(page.locator("h1")).toHaveText("Identity verification");

    await page.locator('input[name="aadhar"]').fill("123456789012");
    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(tinyPngFile("aadhar-front.png"));
    await fileInputs.nth(1).setInputFiles(tinyPngFile("aadhar-back.png"));

    await expect(page.getByAltText("Aadhar front preview")).toBeVisible();
    await expect(page.getByAltText("Aadhar back preview")).toBeVisible();

    await page.getByRole("button", { name: "Submit application" }).click();

    // Brand new agent signups are agentStatus:"pending" -> KYC-gate status screen.
    await page.waitForURL(/\/agent$/);
    await expect(page.locator("h1")).toHaveText("Application under review");
    await expect(page.getByText("Test Cleaner", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("'Agent login' link goes back to the login page", async ({ page }) => {
    await page.goto("/agent/signup");
    await page.getByRole("link", { name: "Agent login" }).click();
    await expect(page).toHaveURL(/\/agent\/login$/);
  });
});

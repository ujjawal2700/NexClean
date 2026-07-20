import { test, expect } from "@playwright/test";
import { DEMO_OTP, freshPhone } from "../../fixtures/api-client";

test.describe("Customer signup", () => {
  test("details step rejects a short name and an invalid phone", async ({ page }) => {
    await page.goto("/app/signup");
    await expect(page.locator("h1")).toHaveText("Join NexClean");

    // Name too short.
    await page.locator('input[name="name"]').fill("A");
    await page.locator('input[name="phone"]').fill(freshPhone());
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter your full name")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Join NexClean");

    // Valid name, invalid phone.
    await page.locator('input[name="name"]').fill("Valid Name");
    await page.locator('input[name="phone"]').fill("123");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a valid 10-digit number")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Join NexClean");
  });

  // KNOWN APP BUG (not a test bug) — see frontend/src/modules/customer/pages/Signup.tsx:34.
  // `if (token) return <Navigate to="/app" replace />;` sits between hook calls (useCustomerSignup
  // before it; useVerifyOtp/useSubmitLead/useState/useRef after it), violating the Rules of Hooks.
  // In the unserviced-city branch of verify() (~line 136-149) there's an `await
  // submitLead.mutateAsync(...)` between `setToken(token)` and `navigate(...)`, which gives React a
  // chance to re-render Signup with `token` now truthy — hitting the early return after only 6 of
  // ~11 hooks have run, throwing "Rendered fewer hooks than expected. This may be caused by an
  // accidental early return statement." React's RouteErrorBoundary catches it and renders "Something
  // went wrong" instead of the intended /app/coming-soon screen. Reproduced deterministically (3/3
  // runs). This test intentionally asserts the CORRECT behavior and is expected to fail (red) until
  // the app bug is fixed — do not weaken this assertion.
  test("full unserviced-city signup flow reaches the coming-soon screen", async ({ page }) => {
    const phone = freshPhone();
    await page.goto("/app/signup");

    await page.locator('input[name="name"]').fill("Aisha Sharma");
    await page.locator('input[name="email"]').fill(`aisha-${phone}@example.com`);
    await page.locator('input[name="phone"]').fill(phone);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.locator("h1")).toHaveText("Select your city");
    // This test DB has no seeded cities, but drive the "not listed" path
    // regardless of catalog state so the test is robust either way.
    await page.getByRole("button", { name: "My city isn't listed" }).click();
    await page.locator('input[name="customCity"]').fill("Pune");
    await page.locator('input[name="customLocation"]').fill("Koregaon Park");
    await page.getByRole("button", { name: "Save my spot & Continue" }).click();

    await expect(page.locator("h1")).toHaveText("Verify your number");
    await page.locator('input[name="otp"]').fill(DEMO_OTP);
    await page.getByRole("button", { name: "Verify & continue" }).click();

    await page.waitForURL(/\/app\/coming-soon$/);
    await expect(page.locator("h1")).toContainText("You're on the list!");
  });

  test("location step requires city name and area when unlisted", async ({ page }) => {
    const phone = freshPhone();
    await page.goto("/app/signup");
    await page.locator('input[name="name"]').fill("Someone Else");
    await page.locator('input[name="phone"]').fill(phone);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.locator("h1")).toHaveText("Select your city");
    await page.getByRole("button", { name: "My city isn't listed" }).click();
    await page.getByRole("button", { name: "Save my spot & Continue" }).click();
    await expect(page.getByText("Please enter your city name")).toBeVisible();

    await page.locator('input[name="customCity"]').fill("Nashik");
    await page.getByRole("button", { name: "Save my spot & Continue" }).click();
    await expect(page.getByText("Please enter your area / locality")).toBeVisible();
  });

  test("signing up twice with the same phone is rejected", async ({ page }) => {
    const phone = freshPhone();

    // First signup — completes account creation via /auth/customer/signup.
    await page.goto("/app/signup");
    await page.locator('input[name="name"]').fill("First Timer");
    await page.locator('input[name="phone"]').fill(phone);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("h1")).toHaveText("Select your city");
    await page.getByRole("button", { name: "My city isn't listed" }).click();
    await page.locator('input[name="customCity"]').fill("Pune");
    await page.locator('input[name="customLocation"]').fill("Baner");
    await page.getByRole("button", { name: "Save my spot & Continue" }).click();
    await expect(page.locator("h1")).toHaveText("Verify your number");

    // Second signup attempt with the SAME phone, in a fresh browsing context
    // (new tab-like navigation) before completing OTP on the first — the
    // account is created at the /auth/customer/signup call itself (step 2),
    // not at OTP verification, so a second full attempt with the same phone
    // should be rejected right at the location step submit.
    await page.goto("/app/signup");
    await page.locator('input[name="name"]').fill("Second Timer");
    await page.locator('input[name="phone"]').fill(phone);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("h1")).toHaveText("Select your city");
    await page.getByRole("button", { name: "My city isn't listed" }).click();
    await page.locator('input[name="customCity"]').fill("Pune");
    await page.locator('input[name="customLocation"]').fill("Baner");
    await page.getByRole("button", { name: "Save my spot & Continue" }).click();

    await expect(page.getByText("An account with this number already exists")).toBeVisible();
    // Stays on the location step (not verify).
    await expect(page.locator("h1")).toHaveText("Select your city");
  });

  test("Log in link navigates to the login page", async ({ page }) => {
    await page.goto("/app/signup");
    await page.getByRole("link", { name: "Log in" }).click();
    await page.waitForURL(/\/app\/login$/);
  });
});

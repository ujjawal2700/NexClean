import { test, expect } from '@playwright/test';

test.describe('SMSINDIAHUB OTP E2E Login Flow', () => {
  let phone: string;
  test.beforeEach(async ({ page }) => {
    phone = '8' + String(Date.now()).slice(-9);
    const signup = await page.request.post('http://localhost:4400/api/auth/customer/signup', {
      data: { name: 'OTP Test Customer', phone, privacyAccepted: true, termsAccepted: true },
    });
    expect(signup.ok()).toBe(true);
    await page.context().clearCookies();
    await page.addInitScript(() => localStorage.setItem('nexclean-cookie-consent', JSON.stringify({ version: 1, necessary: true, functional: false })));
  });
  test('should successfully request OTP and login using the demo code', async ({ page }) => {
    // Navigate to the customer login page
    await page.goto('/app/login');
    await expect(page).toHaveURL(/\/app\/login/);

    // Verify title and input state
    await expect(page.locator('h1')).toHaveText('Welcome back');
    const phoneInput = page.locator('input[name="phone"]');
    await expect(phoneInput).toBeVisible();

    // Type a valid 10-digit mobile number
    await phoneInput.fill(phone);

    // Prepare intercepting the SMS/OTP send request
    const sendOtpPromise = page.waitForResponse(response =>
      response.url().includes('/auth/send-login-otp') && response.status() === 200
    );

    // Click "Send OTP"
    const sendBtn = page.locator('button:has-text("Send OTP")');
    await sendBtn.click();

    // Wait for the backend to respond with success
    const sendResponse = await sendOtpPromise;
    const sendBody = await sendResponse.json();
    expect(sendBody).toHaveProperty('data');
    expect(sendBody.data).toEqual({ sent: true });

    // Verify transition to OTP verification page
    await expect(page.locator('h1')).toHaveText('Verify your number');

    const otpInput = page.locator('input[name="otp"]');
    await expect(otpInput).toBeVisible();

    // Prepare intercepting the verification response
    const verifyOtpPromise = page.waitForResponse(response =>
      response.url().includes('/auth/verify-otp') && response.status() === 200
    );

    // Type the demo OTP code
    await otpInput.fill('123456');

    // Click "Verify & continue"
    const verifyBtn = page.locator('button:has-text("Verify & continue")');
    await verifyBtn.click();

    // Confirm backend successfully verified OTP and returned a token
    const verifyResponse = await verifyOtpPromise;
    const verifyBody = await verifyResponse.json();
    expect(verifyBody).toHaveProperty('data');
    expect(verifyBody.data).toHaveProperty('token');
    expect(verifyBody.data).toHaveProperty('user');

    // Confirm transition to the customer dashboard page (/app)
    await page.waitForURL(/\/app$/);
    await expect(page).toHaveURL(/\/app$/);

    // Dashboard header verification
    await expect(page.locator('h1')).toContainText('OTP');
  });

  test('should display validation error for incorrect OTP', async ({ page }) => {
    await page.goto('/app/login');
    const phoneInput = page.locator('input[name="phone"]');
    await phoneInput.fill(phone);

    // Click Send OTP
    await page.locator('button:has-text("Send OTP")').click();

    // Transition to OTP verification page
    await expect(page.locator('h1')).toHaveText('Verify your number');

    const otpInput = page.locator('input[name="otp"]');
    await expect(otpInput).toBeVisible();
    await otpInput.fill('000000'); // incorrect OTP

    // Prepare intercepting the verification failure
    const verifyOtpPromise = page.waitForResponse(response =>
      response.url().includes('/auth/verify-otp') && response.status() === 400
    );

    await page.locator('button:has-text("Verify & continue")').click();

    const verifyResponse = await verifyOtpPromise;
    const verifyBody = await verifyResponse.json();
    expect(verifyBody).toHaveProperty('message');
    expect(verifyBody.message).toContain('Incorrect code');

    // Verify error is displayed on screen
    await expect(page.locator('text=Incorrect code')).toBeVisible();
  });
});

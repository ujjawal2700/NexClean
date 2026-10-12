import { defineConfig, devices } from '@playwright/test';

// Use dedicated test ports and a disposable local database. Never reuse a
// normal dev server, which may have loaded production credentials from .env.
const reuseTestServers = process.env.REUSE_TEST_SERVERS === '1';
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5190',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run test-start',
      cwd: '../backend',
      port: 4400,
      reuseExistingServer: reuseTestServers,
      env: {
        PORT: '4400',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/nexclean-test',
        JWT_SECRET: 'test-secret-key-1234567890-test-key',
        NODE_ENV: 'test',
        DEMO_OTP: '123456',
        SEED_DEMO_AGENTS: 'true',
        CLIENT_ORIGIN: 'http://localhost:5190',
        ADMIN_EMAIL: 'superadmin@gmail.com',
        ADMIN_PASSWORD: 'password123',
        REDIS_URL: '',
        RAZORPAY_KEY_ID: '',
        RAZORPAY_KEY_SECRET: '',
        CLOUDINARY_CLOUD_NAME: '',
        CLOUDINARY_API_KEY: '',
        CLOUDINARY_API_SECRET: '',
        FIREBASE_SERVICE_ACCOUNT_BASE64: '',
        SMS_INDIA_HUB_USER: '',
        SMS_INDIA_HUB_PASSWORD: '',
        SMS_INDIA_HUB_API_KEY: '',
        RESEND_API_KEY: '',
      },
    },
    {
      command: 'npm run dev -- --port 5190 --strictPort',
      port: 5190,
      reuseExistingServer: reuseTestServers,
      env: { VITE_API_URL: 'http://localhost:4400/api' },
    },
  ],
});

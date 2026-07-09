import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'PATH="/usr/local/bin:$PATH" npm run dev',
      cwd: '../backend',
      port: 4000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '4000',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/nexclean-test',
        JWT_SECRET: 'test-secret-key-1234567890-test-key',
        NODE_ENV: 'test',
        DEMO_OTP: '123456',
        SMS_INDIA_HUB_TEMPLATE: 'Welcome to the NexClean powered by Appzeto.Your OTP for registration is {{otp}}.BGADEC',
        SMS_INDIA_HUB_USER: '',
        SMS_INDIA_HUB_PASSWORD: '',
        SMS_INDIA_HUB_API_KEY: '',
      }
    },
    {
      command: 'PATH="/usr/local/bin:$PATH" npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: 'http://localhost:4000/api',
      }
    }
  ],
});

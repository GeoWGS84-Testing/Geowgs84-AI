// @ts-check
import { defineConfig } from '@playwright/test';
import 'dotenv/config';
import EmailReporter from './reporters/email-reporter.cjs';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 600000,
  expect: { timeout: 10000 },
  
  reporter: [['html', { open: 'never' }], 
             ['list'],
            ['./reporters/email-reporter.cjs']
            ],

  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure', 
    // FIX: Set specific viewport for CI stability
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 15000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
      use: {
        // FIX: Fixed viewport for setup as well
        viewport: { width: 1920, height: 1080 },
        launchOptions: { args: ['--start-maximized'] }
      }
    },
    {
      name: 'chromium',
      use: {
        storageState: '.auth/user.json',
        // FIX: Removed 'null' and set fixed resolution to prevent "Element outside viewport" errors
        viewport: { width: 1920, height: 1080 },
        launchOptions: { args: ['--start-maximized'] }
      },
      dependencies: ['setup'],
    }
  ],
});

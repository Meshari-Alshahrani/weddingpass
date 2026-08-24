import { defineConfig, devices } from '@playwright/test';

/**
 * Browser E2E smoke + business-flow tests (staging / local only).
 *
 * Run:
 *   1) npx playwright install chromium   (once per machine)
 *   2) npm run test:e2e                  (boots `next dev` with mock data)
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
    trace: 'retain-on-failure',
    locale: 'ar-SA',
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'npx next dev -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 90_000,
    env: {
      WEDDINGPASS_ALLOW_MOCK: 'true',
      NODE_ENV: 'development',
    },
  },
});

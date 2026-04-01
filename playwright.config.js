import { defineConfig } from '@playwright/test';
import { TEST_BACKEND_PORT, TEST_FRONTEND_PORT } from './e2e/test-config.js';

const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${TEST_FRONTEND_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `VITE_API_BASE_URL=http://127.0.0.1:${TEST_BACKEND_PORT} npm run dev -- --host 127.0.0.1 --port ${TEST_FRONTEND_PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

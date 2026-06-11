import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'cd apps/server && npx tsx src/index.ts',
      port: 3001,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '3001',
        NODE_ENV: 'test',
      },
    },
    {
      command: 'cd apps/worker && npx tsx src/index.ts',
      port: 3002,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        WORKER_PORT: '3002',
      },
    },
    {
      command: 'cd apps/client/web && npx next dev --port 3000',
      port: 3000,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

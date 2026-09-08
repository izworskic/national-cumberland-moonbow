import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile-390", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "NODE_OPTIONS=--require=./scripts/local-network-shim.cjs npm run dev",
        url: "http://127.0.0.1:3000/api/health",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

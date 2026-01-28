import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:5199",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx --workspace=client vite --port 5199",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

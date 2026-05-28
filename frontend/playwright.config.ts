// Playwright configuration placeholder.
//
// Planned responsibilities:
// - Run E2E tests for login, room creation, approval flow, moderation, and file transfer.
// - Launch multiple browser contexts for multi-participant meeting scenarios.
// - Point tests at a frontend dev server and a configured backend API.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.FRONTEND_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } }
  ]
});

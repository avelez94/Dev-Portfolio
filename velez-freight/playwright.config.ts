import { defineConfig, devices } from "@playwright/test";

// Run through `npm run test:e2e`, which prepares the database, the Supabase stand in and both builds.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 45_000,
  use: { baseURL: process.env.E2E_PRELAUNCH_URL ?? "http://localhost:3101", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

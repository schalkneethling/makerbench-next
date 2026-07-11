import { defineConfig, devices } from "@playwright/test";

const DEFAULT_PLAYWRIGHT_PORT = 5173;

/** Parses the optional E2E server port into a safe TCP port number. */
function parsePlaywrightPort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PLAYWRIGHT_PORT;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("PLAYWRIGHT_PORT must be an integer between 1 and 65535");
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PLAYWRIGHT_PORT must be an integer between 1 and 65535");
  }

  return port;
}

const playwrightPort = parsePlaywrightPort(process.env.PLAYWRIGHT_PORT);
const playwrightBaseUrl = `http://localhost:${playwrightPort}`;

/**
 * Playwright configuration for MakerBench e2e and component testing.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: playwrightBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  webServer: {
    command: `pnpm dev --port=${playwrightPort} --strictPort`,
    url: playwrightBaseUrl,
    reuseExistingServer: !process.env.CI,
  },
});

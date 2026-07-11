import { beforeAll, afterAll, afterEach, vi } from "vitest";
import { server } from "./mocks/server";
import { TEST_SUBMISSION_RATE_LIMIT_SECRET } from "./rate-limit-fixtures";
import "@testing-library/jest-dom/vitest";

/**
 * Global test setup for Vitest with MSW
 */

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

// Reset handlers after each test (removes runtime handlers)
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});

// Mock Netlify global object for function tests
vi.stubGlobal("Netlify", {
  env: {
    get: (key: string): string | undefined => {
      const testEnv: Record<string, string> = {
        SUPABASE_DATABASE_URL: "postgres://test:test@localhost:5432/test",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "test-anon-key",
        BROWSERLESS_API_KEY: "test-browserless-key",
        CLOUDINARY_CLOUD_NAME: "test-cloud",
        CLOUDINARY_API_KEY: "test-api-key",
        CLOUDINARY_API_SECRET: "test-api-secret",
        SUBMISSION_RATE_LIMIT_SECRET: TEST_SUBMISSION_RATE_LIMIT_SECRET,
        SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS: "5",
        SUBMISSION_RATE_LIMIT_WINDOW_SECONDS: "3600",
      };
      return testEnv[key];
    },
    has: (key: string): boolean => {
      const keys = [
        "SUPABASE_DATABASE_URL",
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_ANON_KEY",
        "BROWSERLESS_API_KEY",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
        "SUBMISSION_RATE_LIMIT_SECRET",
        "SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS",
        "SUBMISSION_RATE_LIMIT_WINDOW_SECONDS",
      ];
      return keys.includes(key);
    },
  },
});

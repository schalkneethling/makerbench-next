import { beforeAll, afterAll, afterEach, vi } from "vitest";
import { server } from "./mocks/server";
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
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BROWSERLESS_API_KEY: "test-browserless-key",
        CLOUDINARY_CLOUD_NAME: "test-cloud",
        CLOUDINARY_API_KEY: "test-api-key",
        CLOUDINARY_API_SECRET: "test-api-secret",
      };
      return testEnv[key];
    },
    has: (key: string): boolean => {
      const keys = [
        "TURSO_DATABASE_URL",
        "TURSO_AUTH_TOKEN",
        "BROWSERLESS_API_KEY",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
      ];
      return keys.includes(key);
    },
  },
});

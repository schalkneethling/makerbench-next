import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Sentry from "@sentry/node";

// Mock Sentry
vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((callback) => callback({ setExtras: vi.fn() })),
  flush: vi.fn().mockResolvedValue(true),
}));

// Must import after mocking - only used in non-dynamic tests
import { captureError, flushSentry } from "../sentry";

describe("sentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state by clearing the initialized flag
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initSentry", () => {
    it("skips initialization when SENTRY_DSN is not set", async () => {
      // Import fresh module after reset
      const { initSentry: freshInit } = await import("../sentry");

      // Netlify global not defined = no DSN
      vi.stubGlobal("Netlify", undefined);

      freshInit();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it("initializes Sentry when DSN is available", async () => {
      const { initSentry: freshInit } = await import("../sentry");

      vi.stubGlobal("Netlify", {
        env: {
          get: (key: string) => {
            if (key === "SENTRY_DSN") {
              return "https://test@sentry.io/123";
            }
            if (key === "CONTEXT") {
              return "production";
            }
            return undefined;
          },
        },
      });

      freshInit();

      expect(Sentry.init).toHaveBeenCalledWith({
        dsn: "https://test@sentry.io/123",
        environment: "production",
        tracesSampleRate: 0,
      });
    });

    it("is idempotent - only initializes once", async () => {
      const { initSentry: freshInit } = await import("../sentry");

      vi.stubGlobal("Netlify", {
        env: {
          get: (key: string) => {
            if (key === "SENTRY_DSN") {
              return "https://test@sentry.io/123";
            }
            return "development";
          },
        },
      });

      freshInit();
      freshInit();
      freshInit();

      expect(Sentry.init).toHaveBeenCalledTimes(1);
    });
  });

  describe("captureError", () => {
    it("logs error to console", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("Test error");

      captureError(error);

      expect(consoleSpy).toHaveBeenCalledWith(error);
      consoleSpy.mockRestore();
    });

    it("captures exception with context when provided", async () => {
      const { initSentry: freshInit, captureError: freshCapture } =
        await import("../sentry");

      vi.stubGlobal("Netlify", {
        env: {
          get: (key: string) => {
            if (key === "SENTRY_DSN") {
              return "https://test@sentry.io/123";
            }
            return "development";
          },
        },
      });

      // Initialize first
      freshInit();

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("Test error");

      freshCapture(error, { url: "https://example.com", userId: "123" });

      expect(Sentry.withScope).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("flushSentry", () => {
    it("calls Sentry.flush with timeout", async () => {
      const { initSentry: freshInit, flushSentry: freshFlush } = await import(
        "../sentry"
      );

      vi.stubGlobal("Netlify", {
        env: {
          get: (key: string) => {
            if (key === "SENTRY_DSN") {
              return "https://test@sentry.io/123";
            }
            return "development";
          },
        },
      });

      freshInit();
      await freshFlush();

      expect(Sentry.flush).toHaveBeenCalledWith(2000);
    });

    it("does nothing when not initialized", async () => {
      vi.stubGlobal("Netlify", undefined);

      await flushSentry();

      expect(Sentry.flush).not.toHaveBeenCalled();
    });
  });
});

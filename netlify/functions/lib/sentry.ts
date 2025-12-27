/**
 * Sentry error tracking for Netlify Functions
 *
 * Initializes Sentry and provides error capture utilities.
 * DSN is read from SENTRY_DSN environment variable.
 */
import * as Sentry from "@sentry/node";

let initialized = false;
let isProduction = false;

/**
 * Initialize Sentry SDK (idempotent - safe to call multiple times)
 */
export function initSentry(): void {
  if (initialized) {
    return;
  }

  const dsn =
    typeof Netlify !== "undefined" ? Netlify.env.get("SENTRY_DSN") : undefined;

  if (!dsn) {
    // Skip initialization if DSN not configured (local dev without env vars)
    return;
  }

  // Get Netlify deploy context (production, deploy-preview, branch-deploy, dev)
  const environment =
    typeof Netlify !== "undefined"
      ? Netlify.env.get("CONTEXT") || "development"
      : "development";

  isProduction = environment === "production";

  Sentry.init({
    dsn,
    environment,
    // Error tracking only - no performance tracing to minimize costs
    tracesSampleRate: 0,
  });

  initialized = true;
}

/**
 * Capture an exception and send to Sentry
 * @param error - The error to capture
 * @param context - Optional additional context
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  // Only log to console in non-production for local debugging
  if (!isProduction) {
    console.error(error);
  }

  if (!initialized) {
    return;
  }

  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Flush pending Sentry events (call before function returns)
 * Important for serverless environments to ensure events are sent
 */
export async function flushSentry(): Promise<void> {
  if (!initialized) {
    return;
  }
  // Wait up to 2 seconds for events to send
  await Sentry.flush(2000);
}

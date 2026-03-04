/**
 * Environment validation utilities for Netlify Functions.
 *
 * These helpers intentionally keep details (which keys are missing) internal
 * so API responses can stay generic.
 */
import { captureError, flushSentry } from "./sentry";
import { serviceUnavailable } from "./responses";

const SERVICE_UNAVAILABLE_MESSAGE = "Service temporarily unavailable";

/**
 * Error type used when required environment variables are missing.
 */
export class MissingEnvironmentError extends Error {
  readonly missingKeys: string[];

  constructor(missingKeys: string[]) {
    super("Required environment variables are not configured");
    this.name = "MissingEnvironmentError";
    this.missingKeys = missingKeys;
  }
}

/**
 * Throws when one or more required environment variables are missing.
 */
export function assertRequiredEnv(requiredKeys: readonly string[]): void {
  const missingKeys = requiredKeys.filter((key) => {
    const value =
      typeof Netlify !== "undefined" && Netlify?.env
        ? Netlify.env.get(key)
        : process.env[key];

    return !value || value.trim() === "";
  });

  if (missingKeys.length > 0) {
    throw new MissingEnvironmentError(missingKeys);
  }
}

/**
 * Type guard for missing environment errors.
 */
export function isMissingEnvironmentError(
  error: unknown,
): error is MissingEnvironmentError {
  return error instanceof MissingEnvironmentError;
}

/**
 * Generic client-facing error message for misconfiguration states.
 */
export function getServiceUnavailableMessage(): string {
  return SERVICE_UNAVAILABLE_MESSAGE;
}

/**
 * Maps missing env errors to a safe client response, rethrowing other errors.
 */
export async function handleMissingEnvironmentError(
  error: unknown,
  functionName: string,
): Promise<Response> {
  if (!isMissingEnvironmentError(error)) {
    throw error;
  }

  captureError(error, {
    function: functionName,
    missingKeys: error.missingKeys,
  });
  await flushSentry();
  return serviceUnavailable(getServiceUnavailableMessage());
}

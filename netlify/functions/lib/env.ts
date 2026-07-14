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

/** Error type used when environment values fail their feature-specific contract. */
export class InvalidEnvironmentError extends Error {
  readonly invalidKeys: string[];

  constructor(invalidKeys: string[]) {
    super("Environment variables are invalid");
    this.name = "InvalidEnvironmentError";
    this.invalidKeys = invalidKeys;
  }
}

/** Reads a server environment value from the Netlify runtime. */
export function getEnv(key: string): string | undefined {
  return Netlify.env.get(key) ?? undefined;
}

/**
 * Throws when one or more required environment variables are missing.
 */
export function assertRequiredEnv(requiredKeys: readonly string[]): void {
  const missingKeys = requiredKeys.filter((key) => {
    const value = getEnv(key);

    return !value || value.trim() === "";
  });

  if (missingKeys.length > 0) {
    throw new MissingEnvironmentError(missingKeys);
  }
}

/**
 * Type guard for missing environment errors.
 */
export function isMissingEnvironmentError(error: unknown): error is MissingEnvironmentError {
  return error instanceof MissingEnvironmentError;
}

/** Type guard for invalid environment errors. */
export function isInvalidEnvironmentError(error: unknown): error is InvalidEnvironmentError {
  return error instanceof InvalidEnvironmentError;
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
  diagnosticCode = "service-configuration-unavailable",
): Promise<Response> {
  if (!isMissingEnvironmentError(error)) {
    throw error;
  }

  captureError(error, {
    function: functionName,
    missingKeys: error.missingKeys,
  });
  await flushSentry();
  return serviceUnavailable(getServiceUnavailableMessage(), diagnosticCode);
}

/** Maps invalid environment values to the same safe client response as missing values. */
export async function handleInvalidEnvironmentError(
  error: unknown,
  functionName: string,
  diagnosticCode = "service-configuration-unavailable",
): Promise<Response> {
  if (!isInvalidEnvironmentError(error)) {
    throw error;
  }

  captureError(error, {
    function: functionName,
    invalidKeys: error.invalidKeys,
  });
  await flushSentry();
  return serviceUnavailable(getServiceUnavailableMessage(), diagnosticCode);
}

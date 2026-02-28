/**
 * Custom error classes for database operations
 */

/**
 * Thrown when metadata JSON parsing fails
 */
export class MetadataParseError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "MetadataParseError";
    this.cause = cause;
  }
}

/**
 * Thrown when metadata JSON stringification fails
 */
export class MetadataStringifyError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "MetadataStringifyError";
    this.cause = cause;
  }
}

/**
 * Thrown when URL validation fails
 */
export class InvalidUrlError extends Error {
  constructor(url: string) {
    super(`Invalid URL format: ${url}`);
    this.name = "InvalidUrlError";
  }
}

/**
 * Thrown when tag validation fails
 */
export class TagValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TagValidationError";
  }
}

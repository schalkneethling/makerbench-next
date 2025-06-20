/**
 * Custom error classes for database operations
 */

/**
 * Thrown when metadata JSON parsing fails
 */
export class MetadataParseError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "MetadataParseError";
  }
}

/**
 * Thrown when metadata JSON stringification fails
 */
export class MetadataStringifyError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "MetadataStringifyError";
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

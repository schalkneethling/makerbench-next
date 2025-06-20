import { randomUUID } from "crypto";
import {
  MetadataParseError,
  MetadataStringifyError,
  InvalidUrlError,
  TagValidationError,
} from "./errors";

/**
 * Generates a UUID for database records
 * @returns A new UUID string
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Parses metadata JSON string to object
 * @param metadata - JSON string to parse
 * @returns Parsed metadata object
 * @throws {MetadataParseError} When metadata is null or JSON parsing fails
 */
export function parseMetadata(
  metadata: string | null,
): Record<string, unknown> {
  if (!metadata) {
    throw new MetadataParseError("Metadata is null or undefined");
  }

  try {
    return JSON.parse(metadata);
  } catch (error) {
    throw new MetadataParseError("Failed to parse metadata JSON", error);
  }
}

/**
 * Safely parses metadata JSON string to object
 * @param metadata - JSON string to parse
 * @returns Parsed metadata object or null if parsing fails
 */
export function parseMetadataSafe(
  metadata: string | null,
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

/**
 * Converts metadata object to JSON string
 * @param metadata - Object to stringify
 * @returns JSON string representation
 * @throws {MetadataStringifyError} When metadata is null or stringification fails
 */
export function stringifyMetadata(
  metadata: Record<string, unknown> | null,
): string {
  if (!metadata) {
    throw new MetadataStringifyError("Metadata object is null or undefined");
  }

  try {
    return JSON.stringify(metadata);
  } catch (error) {
    throw new MetadataStringifyError("Failed to stringify metadata", error);
  }
}

/**
 * Safely converts metadata object to JSON string
 * @param metadata - Object to stringify
 * @returns JSON string representation or null if stringification fails
 */
export function stringifyMetadataSafe(
  metadata: Record<string, unknown> | null,
): string | null {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

/**
 * Validates if a string is a valid URL format
 * @param url - URL string to validate
 * @returns True if URL is valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and normalizes URL format
 * @param url - URL string to validate and normalize
 * @returns Normalized URL string
 * @throws {InvalidUrlError} When URL is invalid or malformed
 */
export function validateAndNormalizeUrl(url: string): string {
  if (!url || typeof url !== "string") {
    throw new InvalidUrlError("URL must be a non-empty string");
  }

  try {
    const normalizedUrl = new URL(url);
    return normalizedUrl.toString();
  } catch {
    throw new InvalidUrlError(url);
  }
}

/**
 * Safely validates and normalizes URL format
 * @param url - URL string to validate and normalize
 * @returns Normalized URL string or null if invalid
 */
export function validateAndNormalizeUrlSafe(url: string): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    const normalizedUrl = new URL(url);
    return normalizedUrl.toString();
  } catch {
    return null;
  }
}

/**
 * Normalizes tag name (lowercase, trim, replace spaces with hyphens)
 * @param name - Tag name to normalize
 * @returns Normalized tag name
 * @throws {TagValidationError} When tag name is invalid or empty after normalization
 */
export function normalizeTagName(name: string): string {
  if (!name || typeof name !== "string") {
    throw new TagValidationError("Tag name must be a non-empty string");
  }

  const normalized = name.toLowerCase().trim().replace(/\s+/g, "-");

  if (normalized.length === 0) {
    throw new TagValidationError(
      "Tag name cannot be empty after normalization",
    );
  }

  return normalized;
}

/**
 * Safely normalizes tag name (lowercase, trim, replace spaces with hyphens)
 * @param name - Tag name to normalize
 * @returns Normalized tag name or null if invalid
 */
export function normalizeTagNameSafe(name: string): string | null {
  if (!name || typeof name !== "string") {
    return null;
  }

  const normalized = name.toLowerCase().trim().replace(/\s+/g, "-");

  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

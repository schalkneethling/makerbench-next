/**
 * URL normalization utilities for duplicate checking
 */

/**
 * Normalizes a URL for consistent storage and duplicate checking
 * - Lowercases the hostname
 * - Removes trailing slashes
 * - Removes default ports
 * - Sorts query parameters
 */
export function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);

    // Lowercase hostname
    url.hostname = url.hostname.toLowerCase();

    // Remove default ports
    if (
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")
    ) {
      url.port = "";
    }

    // Remove trailing slash from pathname (except for root)
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    // Sort query parameters for consistency
    url.searchParams.sort();

    // Remove fragment (anchor)
    url.hash = "";

    return url.toString();
  } catch {
    // If parsing fails, return original
    return urlString;
  }
}

/**
 * Validates and normalizes a URL, returning null if invalid
 */
export function parseAndNormalizeUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return normalizeUrl(urlString);
  } catch {
    return null;
  }
}


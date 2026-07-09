/**
 * Shared GitHub validation and parsing helpers.
 */

export const GITHUB_USERNAME_MAX_LENGTH = 39;
const GITHUB_USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

/**
 * Returns true when a value can be used as a GitHub profile username segment.
 */
export function isValidGithubUsername(username: string): boolean {
  return (
    username.length <= GITHUB_USERNAME_MAX_LENGTH &&
    GITHUB_USERNAME_PATTERN.test(username)
  );
}

/**
 * Returns true when URL is a GitHub profile URL in the form:
 * https://github.com/<username>
 */
export function isValidGithubProfileUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "https:") {
      return false;
    }

    if (parsedUrl.hostname !== "github.com") {
      return false;
    }

    if (parsedUrl.search || parsedUrl.hash) {
      return false;
    }

    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathSegments.length !== 1) {
      return false;
    }

    return isValidGithubUsername(pathSegments[0]);
  } catch {
    return false;
  }
}

/**
 * Extracts username from a valid GitHub profile URL.
 */
export function getGithubUsernameFromProfileUrl(url: string): string | null {
  if (!isValidGithubProfileUrl(url)) {
    return null;
  }

  const parsedUrl = new URL(url);
  return parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
}

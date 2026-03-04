/**
 * Shared GitHub validation and parsing helpers.
 */

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const GITHUB_USERNAME_PATTERN =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

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

    if (!GITHUB_HOSTS.has(parsedUrl.hostname)) {
      return false;
    }

    if (parsedUrl.search || parsedUrl.hash) {
      return false;
    }

    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathSegments.length !== 1) {
      return false;
    }

    return GITHUB_USERNAME_PATTERN.test(pathSegments[0]);
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

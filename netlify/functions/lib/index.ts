/**
 * Shared utilities for Netlify Functions
 */

export { getDb } from "./db";
export * from "./responses";
export { normalizeUrl, parseAndNormalizeUrl } from "./url";
export { initSentry, captureError, flushSentry } from "./sentry";
export { parseAggregatedTags } from "./tags";
export {
  getVerifiedDisplayName,
  getVerifiedGithubUsername,
  verifyAuthenticatedUser,
  type AuthenticatedUser,
} from "./auth";
export { assertRequiredEnv, handleMissingEnvironmentError } from "./env";
export {
  bookmarksTable,
  resourcesTable,
  toolListingsTable,
  publicListingsTable,
  publicStacksTable,
  publicStackItemsTable,
  userRolesTable,
} from "../../../src/db/schema";

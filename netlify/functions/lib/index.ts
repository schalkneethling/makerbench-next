/**
 * Shared utilities for Netlify Functions
 */

export { getDb } from "./db";
export * from "./responses";
export { normalizeUrl, parseAndNormalizeUrl } from "./url";
export { bookmarksTable, tagsTable, bookmarkTagsTable } from "../../../src/db/schema";


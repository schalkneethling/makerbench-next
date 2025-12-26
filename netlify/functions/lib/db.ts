import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

/**
 * Creates database client for Netlify Functions context
 * Uses Netlify.env.get() instead of import.meta.env
 */
function createDbClient() {
  if (typeof Netlify === "undefined") {
    throw new Error("Must run in Netlify Functions context");
  }

  const url = Netlify.env.get("TURSO_DATABASE_URL");
  const authToken = Netlify.env.get("TURSO_AUTH_TOKEN");

  if (!url) {
    throw new Error("TURSO_DATABASE_URL not configured");
  }

  const client = createClient({
    url,
    authToken,
  });

  return drizzle(client);
}

// Lazy initialization to avoid issues with global scope
let dbInstance: ReturnType<typeof createDbClient> | null = null;

/**
 * Gets the database instance (lazy singleton)
 */
export function getDb() {
  if (!dbInstance) {
    dbInstance = createDbClient();
  }
  return dbInstance;
}

// Re-export schema for convenience
export * from "../../../src/db/schema";

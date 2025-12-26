import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

/**
 * Creates libSQL client for Turso database connection
 */
const client = createClient({
  url: import.meta.env.VITE_TURSO_DATABASE_URL,
  authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN,
});

/**
 * Drizzle ORM database instance configured for Turso
 */
export const db = drizzle(client);

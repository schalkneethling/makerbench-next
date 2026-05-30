import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "../../../src/db/schema";

function getEnv(key: string): string | undefined {
  if (typeof Netlify !== "undefined" && Netlify?.env) {
    return Netlify.env.get(key) ?? undefined;
  }

  return process.env[key];
}

function createDbClient() {
  const connectionString = getEnv("SUPABASE_DATABASE_URL") ?? getEnv("DATABASE_URL");

  if (!connectionString) {
    throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL is not configured");
  }

  // SUPABASE_DATABASE_URL must be the server-only Postgres URL, ideally the
  // Supabase pooler connection string, because Functions perform trusted writes.
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 5000,
  });
  return drizzle(pool, { schema });
}

let dbInstance: ReturnType<typeof createDbClient> | null = null;

export function getDb() {
  dbInstance ??= createDbClient();
  return dbInstance;
}

export * from "../../../src/db/schema";

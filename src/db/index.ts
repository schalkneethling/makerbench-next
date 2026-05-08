import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

function getDatabaseUrl(): string {
  const databaseUrl =
    process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL is required");
  }

  return databaseUrl;
}

const pool = new pg.Pool({
  connectionString: getDatabaseUrl(),
});

export const db = drizzle(pool, { schema });

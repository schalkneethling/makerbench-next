import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";
import "varlock/auto-load";
import { ENV } from "varlock/env";

/**
 * Records migration 0001 in Drizzle's journal when its SQL changes are already
 * present in the database but the migration row was never written.
 */
async function main() {
  const dbUrl = ENV.SUPABASE_DATABASE_URL ?? ENV.DATABASE_URL;

  if (!dbUrl) {
    throw new Error("SUPABASE_DATABASE_URL is not configured");
  }

  const migrationPath = join(
    process.cwd(),
    "migrations/postgres/0001_review_followups.sql",
  );
  const migrationSql = readFileSync(migrationPath, "utf8");
  const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
  const migrationCreatedAt = 1778265600000;

  const client = new pg.Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 15000,
  });

  await client.connect();

  try {
    const existing = await client.query(
      `SELECT created_at
       FROM drizzle.__drizzle_migrations
       WHERE created_at = $1`,
      [migrationCreatedAt],
    );

    if (existing.rows.length > 0) {
      console.log("Migration 0001 is already recorded in drizzle.__drizzle_migrations");
      return;
    }

    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
       VALUES ($1, $2)`,
      [migrationHash, migrationCreatedAt],
    );

    console.log("Recorded migration 0001 in drizzle.__drizzle_migrations");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

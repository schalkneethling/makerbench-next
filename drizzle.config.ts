import type { Config } from "drizzle-kit";
import "varlock/auto-load";
import { ENV } from "varlock/env";

const dbUrl = ENV.SUPABASE_DATABASE_URL ?? ENV.DATABASE_URL;

if (!dbUrl) {
  throw new Error("Missing SUPABASE_DATABASE_URL or DATABASE_URL environment variable");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./migrations/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
} satisfies Config;

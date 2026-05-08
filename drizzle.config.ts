import type { Config } from "drizzle-kit";
import "varlock/auto-load";
import { ENV } from "varlock/env";

export default {
  schema: "./src/db/schema.ts",
  out: "./migrations/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: ENV.SUPABASE_DATABASE_URL ?? ENV.DATABASE_URL!,
  },
} satisfies Config;

import type { Config } from "drizzle-kit";
import "varlock/auto-load";
import { ENV } from "varlock/env";

export default {
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "turso",
  dbCredentials: {
    url: ENV.TURSO_DATABASE_URL!,
    authToken: ENV.TURSO_AUTH_TOKEN,
  },
} satisfies Config;

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.VITE_TURSO_DATABASE_URL!,
    authToken: process.env.VITE_TURSO_AUTH_TOKEN,
  },
} satisfies Config;

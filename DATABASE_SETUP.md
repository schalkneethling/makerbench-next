# Database Setup (Turso)

Last updated: February 26, 2026

This document covers Turso setup only.
For complete app setup and deployment, see:

- Local runbook: [docs/local-development.md](./docs/local-development.md)
- Production runbook: [docs/production-deployment.md](./docs/production-deployment.md)

## Prerequisites

- Turso CLI: https://docs.turso.tech/cli/installation
- Turso account: https://turso.tech

## Create a database

```bash
turso auth login
turso db create makerbench-db
turso db show --url makerbench-db
turso db tokens create makerbench-db
```

Use the returned values for:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

## Apply schema

From the project root:

```bash
npx drizzle-kit push
```

If `src/db/schema.ts` changed:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

## Environment variable usage

- Drizzle Kit reads from `process.env` (see `drizzle.config.ts`).
- Netlify Functions read from `Netlify.env.get(...)`.
- Do not use `VITE_` prefixes for these database variables.

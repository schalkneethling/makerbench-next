# Database Setup (Supabase Postgres)

Last updated: July 14, 2026

MakerBench uses Supabase Postgres as its canonical database and Supabase Auth
for Google and GitHub sign-in. Netlify Functions connect to Postgres through
Drizzle, while the browser uses the Supabase URL and anon key for auth.

For the complete workflows, see:

- Local development: [docs/local-development.md](./docs/local-development.md)
- Production deployment: [docs/production-deployment.md](./docs/production-deployment.md)

## Prerequisites

- A Supabase project with access to its database and Auth settings
- Node.js 24.x
- pnpm 11.5.0, as pinned by `package.json`
- The repository's Varlock and 1Password setup for resolving `.env.schema`

## Create or select the Supabase project

1. Create a Supabase project, or select the existing MakerBench project.
2. In the Supabase dashboard, open the database connection details and copy a
   PostgreSQL connection string. Use the Supabase pooler connection string for
   serverless workloads when available.
3. Keep the connection string server-only. It must only be provided as
   `SUPABASE_DATABASE_URL` and must never be bundled into the Vite client.

## Configure Supabase Auth

The application calls Supabase Auth with the `google` and `github` providers.
Enable and configure those providers in the Supabase dashboard if they are
needed for the environment.

In Supabase Auth URL configuration, allow the application origins used by the
environment:

- The local origin printed by `netlify dev`
- The production Netlify site URL

The application sends the current browser origin as the OAuth redirect URL.

## Environment variables

`.env.schema` is the source of truth for required local variable names and the
checked-in Varlock/1Password references. Use the exact names below:

| Variable                               | Scope             | Purpose                                                        |
| -------------------------------------- | ----------------- | -------------------------------------------------------------- |
| `SUPABASE_DATABASE_URL`                | Server only       | Supabase Postgres connection string                            |
| `VITE_SUPABASE_URL`                    | Client and server | Supabase project URL                                           |
| `VITE_SUPABASE_ANON_KEY`               | Client and server | Supabase anon key for browser auth and server JWT verification |
| `CLOUDINARY_CLOUD_NAME`                | Server only       | Cloudinary cloud name                                          |
| `CLOUDINARY_API_KEY`                   | Server only       | Cloudinary API key                                             |
| `CLOUDINARY_API_SECRET`                | Server only       | Cloudinary API secret                                          |
| `BROWSERLESS_API_KEY`                  | Server only       | Browserless screenshot API key                                 |
| `SUBMISSION_RATE_LIMIT_SECRET`         | Server only       | 64-character hexadecimal HMAC secret                           |
| `SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS`   | Server only       | Attempts allowed per fixed window                              |
| `SUBMISSION_RATE_LIMIT_WINDOW_SECONDS` | Server only       | Fixed-window duration in seconds                               |

`SENTRY_DSN` is a separate optional server-side setting supported by the
Functions; it is not required by `.env.schema`. Netlify supplies `CONTEXT`
automatically for Sentry environment tagging. Do not add `VITE_` to server-only
secrets, and use the required variable names in `.env.schema` for the active
application setup.

## Apply the database schema

Install dependencies and apply the committed PostgreSQL migrations from the
project root:

```bash
pnpm install
pnpm db:migrate
```

Drizzle Kit reads `SUPABASE_DATABASE_URL` through `drizzle.config.ts`. The
migrations live in `migrations/postgres/`, and the journal in
`migrations/postgres/meta/` is part of the migration history.

When `src/db/schema.ts` changes:

```bash
pnpm db:generate
pnpm db:migrate
```

Review the generated SQL, commit the migration and its journal metadata, and
apply it to the target Supabase project before deploying code that depends on
it. Do not use `drizzle-kit push` for the active workflow; schema changes must
be represented by committed migrations.

## Configure the first admin

Admin users are identified by a `public.user_roles` row with `role = 'admin'`.
Because browser roles cannot promote themselves, add the first row from a
trusted Supabase SQL editor or equivalent privileged connection, using the UUID
of an existing verified `auth.users` account:

```sql
insert into public.user_roles (user_id, role)
values ('<auth-user-uuid>', 'admin')
on conflict (user_id, role) do nothing;
```

Sign in as that user and verify `GET /api/auth/whoami` returns
`isAdmin: true`. Subsequent role changes must also use a trusted database
context.

## Historical Turso import

Turso is no longer the active database. The repository retains
`scripts/import-makerbench-turso.ts` only to import historical Turso export
data into the current Postgres schema when needed.

The package script performs a dry run by default:

```bash
pnpm migrate:makerbench-turso --source=./makerbench-export.json
```

After reviewing the dry-run output, `--execute` writes to the configured
Supabase Postgres database. Treat the export as untrusted input, keep database
credentials out of the export and command history, and do not use the Turso
CLI for normal development or deployment.

# Local Development

Last updated: July 11, 2026

MakerBench runs locally as a Vite React frontend plus Netlify Functions. Use
Supabase Postgres for data, Supabase Auth for sign-in, and Netlify Dev so the
frontend and `/api/*` Functions share one local workflow.

Related runbooks:

- Database details: [../DATABASE_SETUP.md](../DATABASE_SETUP.md)
- Production deployment: [production-deployment.md](./production-deployment.md)

## Prerequisites

- Node.js 24.x
- pnpm 11.5.0, as pinned by `package.json`
- Netlify CLI (`pnpm add --global netlify-cli`)
- A Supabase project and its Postgres/Auth configuration
- Access to the repository's Varlock and 1Password setup

## 1. Install dependencies

```bash
pnpm install
```

The repository pins pnpm in `package.json`, so use that version locally and in
Netlify builds.

## 2. Configure environment variables

Use [`.env.schema`](../.env.schema) as the canonical list of required local
variables managed through Varlock. Resolve its Varlock/1Password references
using the repository's normal local environment workflow before starting
Netlify Dev or running Drizzle commands. Do not commit resolved secrets or
create a second checked-in environment file.

The required names are:

- `SUPABASE_DATABASE_URL` - server-only Supabase Postgres connection string
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key for browser auth
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `BROWSERLESS_API_KEY`
- `SUBMISSION_RATE_LIMIT_SECRET` - a server-only random secret of at least 32 characters
- `SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS` - positive integer, at most 1000
- `SUBMISSION_RATE_LIMIT_WINDOW_SECONDS` - positive integer, at most 86400

`SENTRY_DSN` is a separate optional setting read by the Functions when
configured; it is not required by `.env.schema`. The `VITE_` variables are
exposed to the browser by Vite; the database and service credentials are
server-side values. `SUBMISSION_RATE_LIMIT_SECRET` is intentionally supplied
through a secure local environment source rather than assigned in
`.env.schema`; its tuning values are defined there. Netlify Functions read
their values from `Netlify.env`.

## 3. Apply Supabase migrations

From the project root, apply the committed PostgreSQL migration history:

```bash
pnpm db:migrate
```

When `src/db/schema.ts` changes, generate and then apply a migration:

```bash
pnpm db:generate
pnpm db:migrate
```

Review generated SQL before committing it. Do not use `drizzle-kit push` for
the project workflow. See [Database setup](../DATABASE_SETUP.md) for the
Supabase project, Auth, and migration details.

## 4. Run the app locally

Start Netlify Dev after the environment has been resolved:

```bash
netlify dev
```

Use the URL printed by Netlify Dev. It proxies the Vite frontend and Netlify
Functions together, which is required for `/api/*` requests. Plain `pnpm dev`
only starts Vite and is useful for frontend-only work, not full end-to-end
local behavior.

If OAuth is being tested, add the local URL printed by Netlify Dev to the
allowed redirect URLs in Supabase Auth settings. The app uses the current
browser origin for the redirect.

## 5. Verify local setup

1. Open the URL printed by `netlify dev`.
2. Confirm the home page loads without console or API errors.
3. Sign in with a configured Supabase Auth provider if auth is being tested.
4. Submit a bookmark from `/submit`.
5. Confirm `GET /api/tools` returns approved tools.
6. Confirm `GET /api/tools/search?q=...` returns JSON.
7. Confirm authenticated library requests work at `/library`.

## 6. Quality checks

```bash
pnpm lint
pnpm lint:css
pnpm typecheck
pnpm test
pnpm build
npx vitest --project storybook run
```

The Storybook interaction tests require the Playwright Chromium browser. Run
`npx playwright install chromium` once if the executable is not installed.

## 7. Storybook

Storybook runs the UI in isolation with the same CSS, auth/router decorators,
and MSW handlers as the shared preview:

```bash
pnpm storybook
pnpm build-storybook
npx vitest --project storybook run
```

Stories are colocated with components under `src/components/`. Configuration
lives in `.storybook/`.

## Troubleshooting

### Supabase or Auth variables are missing

- Confirm the values from `.env.schema` have been resolved before starting
  Netlify Dev.
- Confirm the names are exactly `SUPABASE_DATABASE_URL`,
  `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
- Restart `netlify dev` after changing environment values.

### Bookmark submission cannot capture an image

Confirm `BROWSERLESS_API_KEY` is available. If Browserless is unavailable or
the target page has no OG image, the application may use its fallback behavior.

### Database migration fails

Confirm `SUPABASE_DATABASE_URL` points to the intended Supabase Postgres
project and that the migration files and `migrations/postgres/meta/_journal.json`
are present. Do not delete migration history to work around a mismatch; inspect
the database migration history and reconcile it before retrying.

### Local tests report localhost DNS errors

This usually indicates a local environment DNS issue rather than application
logic. Retry in a standard shell/network environment.

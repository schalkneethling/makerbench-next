# Production Deployment

Last updated: July 14, 2026

MakerBench is deployed as a Vite static frontend and Netlify Functions backed
by Supabase Postgres and Supabase Auth. Build settings are defined in
`netlify.toml`.

Related runbooks:

- Database details: [../DATABASE_SETUP.md](../DATABASE_SETUP.md)
- Local development: [local-development.md](./local-development.md)
- Launch checklist: [launch-checklist.md](./launch-checklist.md)

## Runtime baseline

- Node.js 24.x
- pnpm 11.5.0, pinned by `package.json`
- Netlify build command: `pnpm build`
- Static publish directory: `dist`
- Functions directory: `netlify/functions`

Bun is not part of the production deployment workflow.

## Prerequisites

- A Netlify site connected to this repository
- A Supabase production project
- Supabase Auth providers and redirect URLs configured for the production site
- Cloudinary credentials
- A Browserless API key
- An optional Sentry DSN
- At least one verified Supabase user assigned the `admin` role

## 1. Configure Supabase Postgres and Auth

Use the production Supabase project and obtain its PostgreSQL connection string
from the Supabase connection details. Use the pooler connection string for
Netlify Functions when available.

Configure the Google and GitHub providers used by the application in Supabase
Auth. Add the production Netlify site URL to Supabase's allowed redirect URLs.
The application sends the current browser origin as the OAuth redirect URL.

See [Database setup](../DATABASE_SETUP.md) for the full Supabase and Auth
setup, including the server-only connection string requirement.

## 2. Configure Netlify environment variables

In the Netlify site settings, set these variables for every production deploy
context that needs them:

- `SUPABASE_DATABASE_URL` - server-only Supabase Postgres connection string
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `BROWSERLESS_API_KEY`
- `SUBMISSION_RATE_LIMIT_SECRET` - server-only HMAC secret (exactly 64 hexadecimal characters)
- `SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS` - positive integer, at most 1000
- `SUBMISSION_RATE_LIMIT_WINDOW_SECONDS` - positive integer, at most 86400
- `SENTRY_DSN` (optional)

The `VITE_` variables must be available during the frontend build and to the
Functions. The database and service credentials must remain server-side and
must not be committed or placed in frontend source. Netlify Functions read
runtime values through `Netlify.env`; Netlify supplies `CONTEXT` automatically.

Use the required variable names in [`.env.schema`](../.env.schema).
The blank `SUBMISSION_RATE_LIMIT_SECRET` assignment there is deliberate: it
declares a sensitive external value without a repository default while allowing
frontend-only builds to run. Configure it in Netlify before enabling public
submissions; the submission Function requires it at runtime and fails closed
with a generic 503 when it is absent, is not exactly 64 characters, or contains
non-hexadecimal characters. Generate a suitable value with
`openssl rand -hex 32` and store it only in Netlify's secure environment
settings.
`SENTRY_DSN` is a separate optional Netlify runtime setting. Do not configure
legacy database variables for the active deployment.

## 3. Apply migrations before deploying code

From a trusted environment with the production `SUPABASE_DATABASE_URL`
available, apply the committed PostgreSQL migrations:

```bash
pnpm db:migrate
```

For a schema change, generate the migration, review it, commit it, and apply
it before deploying the dependent application code:

```bash
pnpm db:generate
pnpm db:migrate
```

The migration files and `migrations/postgres/meta/_journal.json` must be
included in the repository. Do not use `drizzle-kit push`, and do not make
untracked dashboard changes that bypass the Drizzle migration history.

## 4. Run pre-deploy checks

```bash
pnpm lint
pnpm lint:css
pnpm typecheck
pnpm test
npx vitest --project storybook run
npx playwright test --project=chromium
pnpm build
```

The Playwright command automatically starts the Vite server configured in
`playwright.config.ts`; a separate `netlify dev` or preview/staging server is not
required for the current frontend E2E suite. Running Playwright before
`pnpm build` is intentional: the E2E tests exercise source through that
configured development server, while `pnpm build` separately validates the
production compilation.

Storybook is a development and CI aid. `pnpm build-storybook` is not part of
the Netlify production build unless a separate publish step is introduced.

## 5. Deploy

The normal flow is Git-based deployment:

1. Merge or push the release commit to the branch connected to production.
2. Netlify runs `pnpm build`.
3. Netlify publishes `dist` and deploys Functions from `netlify/functions`.

## 6. Verify the deployment

1. Load the homepage, `/resources`, and `/submit`.
2. Test anonymous submission and Supabase sign-in; confirm new public
   submissions return `201` with `pending` status.
3. Repeat a submitted URL across both public kinds and confirm the expected
   status-aware `409` response.
4. Sign in as an admin, verify `/admin/moderation`, and approve or reject a test
   item. Confirm only approved content appears publicly.
5. Add a temporary blocklist rule, confirm a matching submission receives the
   generic rejection and creates a private audit event, then remove the rule.
6. Verify `/library` remains private to the authenticated user.
7. Confirm the public list and search APIs return approved content.
8. Check Netlify Function logs and, when configured, Sentry for new errors.

## SPA routing

`netlify.toml` already redirects all paths to `/index.html` with status `200`
for client-side routes such as `/submit`, `/about`, and `/privacy`. If a
production deep-link refresh returns `404`, verify that the deployed Netlify
configuration includes this redirect:

```toml
[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

## Rollback

Use Netlify deploy history to restore the previous successful deploy. Database
migrations are not rolled back by a Netlify restore; deploy a compatible
application version or apply a reviewed forward migration. Rotating
`SUBMISSION_RATE_LIMIT_SECRET` resets rate-limit continuity for all identities.

## Security

- Never commit `.env` files, resolved `.env.schema` values, or database URLs.
- Keep `SUPABASE_DATABASE_URL` server-only and use a pooler connection for
  serverless workloads when available.
- Rotate Supabase, Cloudinary, Browserless, and Sentry credentials if exposed.
- Keep `SENTRY_DSN` optional in non-production environments.

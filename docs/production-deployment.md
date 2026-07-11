# Production Deployment

Last updated: July 11, 2026

MakerBench is deployed as a Vite static frontend and Netlify Functions backed
by Supabase Postgres and Supabase Auth. Build settings are defined in
`netlify.toml`.

Related runbooks:

- Database details: [../DATABASE_SETUP.md](../DATABASE_SETUP.md)
- Local development: [local-development.md](./local-development.md)

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
- `SUBMISSION_RATE_LIMIT_SECRET` - server-only HMAC secret (32+ characters)
- `SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS` - positive integer, at most 1000
- `SUBMISSION_RATE_LIMIT_WINDOW_SECONDS` - positive integer, at most 86400
- `SENTRY_DSN` (optional)

The `VITE_` variables must be available during the frontend build and to the
Functions. The database and service credentials must remain server-side and
must not be committed or placed in frontend source. Netlify Functions read
runtime values through `Netlify.env`; Netlify supplies `CONTEXT` automatically.

Use the required variable names in [`.env.schema`](../.env.schema).
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
pnpm build
```

Storybook is a development and CI aid. `pnpm build-storybook` is not part of
the Netlify production build unless a separate publish step is introduced.

## 5. Deploy

The normal flow is Git-based deployment:

1. Merge or push the release commit to the branch connected to production.
2. Netlify runs `pnpm build`.
3. Netlify publishes `dist` and deploys Functions from `netlify/functions`.

## 6. Verify the deployment

1. Load the homepage and `/submit`.
2. Test Supabase sign-in with a configured provider.
3. Confirm `GET /api/tools` returns approved tools.
4. Confirm `GET /api/tools/search?q=test` returns JSON.
5. Submit a bookmark and confirm a `201` response.
6. For an authenticated user, verify `/library` and its API requests.
7. Check Netlify Function logs for runtime errors.
8. If Sentry is configured, verify that events arrive in the expected project.

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

Use Netlify deploy history to restore the previous successful deploy. If the
rollback is related to a schema mismatch, deploy the matching application
version or apply a forward-compatible migration before releasing again.

## Security

- Never commit `.env` files, resolved `.env.schema` values, or database URLs.
- Keep `SUPABASE_DATABASE_URL` server-only and use a pooler connection for
  serverless workloads when available.
- Rotate Supabase, Cloudinary, Browserless, and Sentry credentials if exposed.
- Keep `SENTRY_DSN` optional in non-production environments.

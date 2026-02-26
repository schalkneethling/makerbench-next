# Production Deployment

Last updated: February 26, 2026

## Overview

MakerBench is deployed as:

- Static frontend bundle (`dist`)
- Netlify Functions (`netlify/functions`)
- Turso as the primary database

Build config is defined in `netlify.toml`.

## Prerequisites

- Netlify site connected to this repository
- Turso production database created
- Browserless API key
- Cloudinary credentials
- (Optional) Sentry DSN

## 1. Create/verify production database

Using Turso CLI:

```bash
turso auth login
turso db create makerbench-prod
turso db show --url makerbench-prod
turso db tokens create makerbench-prod
```

Save the URL/token securely for Netlify environment variables.

## 2. Configure Netlify environment variables

In Netlify site settings, add:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BROWSERLESS_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SENTRY_DSN` (optional)

Also ensure Netlify provides `CONTEXT` automatically (used by Sentry env tagging).

## 3. Apply schema before deploying code

Important order of operations:

1. Apply DB schema changes
2. Deploy code that depends on them

From a trusted environment with production DB credentials:

```bash
npx drizzle-kit push
```

If schema changed:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

## 4. Run pre-deploy quality gates

```bash
npm run lint
npm run lint:css
npm run typecheck
npm test
npm run build
```

## 5. Deploy

Typical flow is Git-based deployment via Netlify:

1. Push branch/merge to production branch
2. Netlify runs `npm run build`
3. Netlify publishes `dist` and deploys functions from `netlify/functions`

## 6. Post-deploy verification

1. Load homepage and `/submit`.
2. Verify function endpoints:
   - `GET /api/bookmarks`
   - `GET /api/bookmarks/search?q=test`
3. Submit a bookmark and confirm response `201`.
4. Check function logs in Netlify for runtime errors.
5. If Sentry enabled, verify events are received.

## Routing note for SPA paths

MakerBench uses client-side routing (`/submit`, `/about`, `/privacy`).
If deep-link refreshes return 404 in production, add an SPA redirect rule in Netlify:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Rollback strategy

- Use Netlify deploy history to rollback to the previous successful deploy.
- If rollback is due to schema mismatch, either:
  - re-deploy matching app version, or
  - apply forward-compatible schema changes before re-release.

## Security and secrets

- Never commit `.env`.
- Rotate Turso, Browserless, and Cloudinary secrets if exposed.
- Keep `SENTRY_DSN` optional for non-production environments.

# Local Development

Last updated: February 26, 2026

## Prerequisites

- Node.js 20+
- npm 10+
- Netlify CLI (recommended): `npm i -g netlify-cli`
- Turso database + auth token

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy the example file and set values:

```bash
cp .env.example .env
```

Required variables for full local functionality:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BROWSERLESS_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SENTRY_DSN` (optional)

Notes:

- These are server-side variables used by Netlify Functions.
- Do not prefix with `VITE_`.

## 3. Initialize database schema

Push the schema to your Turso database:

```bash
npx drizzle-kit push
```

If you changed `src/db/schema.ts`, generate a migration before pushing:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

## 4. Run the app locally

Use Netlify Dev so both frontend and functions run together:

```bash
netlify dev
```

Why not `npm run dev` only?

- The app calls `/api/...` endpoints.
- Those endpoints are Netlify Functions, so plain Vite dev server is not enough for end-to-end local behavior.

## 5. Verify local setup

Checklist:

1. Open app at the URL printed by `netlify dev`.
2. Home page loads without console/API errors.
3. Submit a bookmark from `/submit`.
4. `GET /api/bookmarks` returns JSON (approved bookmarks only).
5. `GET /api/bookmarks/search?q=...` returns JSON.

## 6. Quality checks

```bash
npm run lint
npm run lint:css
npm run typecheck
npm test
npm run build
```

## Troubleshooting

## `TURSO_DATABASE_URL not configured`

- Confirm `.env` exists and includes `TURSO_DATABASE_URL`.
- Restart `netlify dev` after env changes.

## Bookmark submission returns fallback image often

- This can happen when:
  - target page has no OG image, and
  - `BROWSERLESS_API_KEY` is missing/invalid, or screenshot capture fails.

## Local tests fail with localhost DNS errors

- Environment DNS resolution issue (not app logic).
- Retry in a standard shell/network environment.

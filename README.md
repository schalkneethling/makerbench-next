# MakerBench

MakerBench is a curated bookmarking platform for developer and maker tools, resources, and articles.

## Requirements

- Node.js 24.x
- pnpm (unversioned by policy)

Runtime/package manager decision:

- Netlify Functions run on Node.js, so Bun is intentionally not part of this deployment workflow.

## Current Status (May 2026)

Core functionality is implemented:

- Submit a tool URL with tags (stored as `pending` until moderation exists)
- Extract metadata (title/description/OG image)
- Capture screenshot fallback with Browserless when OG image is missing
- Store fallback screenshots in Cloudinary
- Persist data in Supabase Postgres (Drizzle ORM)
- Browse and search approved tools (`/`, `/tools`)
- Browse and search public resources and stacks (`/resources`)
- Personal bookmark library with Google/GitHub sign-in (`/library`)
- Filter by tags with URL-synced state
- Responsive React UI with routing (`/submit`, `/about`, `/privacy`)

## Tech Stack

- React 19 + TypeScript + Vite
- React Compiler
- Netlify Functions
- Supabase (Postgres + Auth) + Drizzle ORM
- Valibot validation
- Browserless (screenshots)
- Cloudinary (image storage)
- Vitest + Testing Library + Playwright

## Development

```bash
pnpm dev
pnpm test
pnpm lint
pnpm lint:css
pnpm typecheck
pnpm build
```

For full local setup (including Netlify Functions + env configuration), use:
- [docs/local-development.md](./docs/local-development.md)

## Environment Variables

Environment variables are defined in [`.env.schema`](./.env.schema) (Varlock). See [docs/local-development.md](./docs/local-development.md) for setup.

Required for full local functionality:

- `SUPABASE_DATABASE_URL` — server-only Postgres connection string
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (client auth + server JWT verification)
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `BROWSERLESS_API_KEY`
- `SENTRY_DSN` (optional)

Package manager note: this repository pins pnpm via `packageManager` in `package.json` so Netlify Corepack resolves the exact pnpm version during builds.

## API Endpoints

Public:

- `POST /api/tools` — submit a tool (stored as `pending`)
- `GET /api/tools` — list approved tools (paginated)
- `GET /api/tools/search` — search/filter approved tools
- `GET /api/tools/tags` — tag cloud with usage counts
- `GET /api/resources` — list approved public resources and stacks
- `GET /api/resources/search` — search public resources and stacks

Authenticated (Bearer token):

- `GET /api/auth/whoami` — current user and admin flag
- `GET /api/library` — list personal bookmarks
- `POST /api/library` — add a URL to personal library

See [architecture.md](./architecture.md) for request/response shapes and data flows.

## Issue Tracking

Open backlog is tracked in GitHub Issues:
[https://github.com/schalkneethling/makerbench-next/issues](https://github.com/schalkneethling/makerbench-next/issues)

## Documentation

- Architecture: [architecture.md](./architecture.md)
- Local setup: [docs/local-development.md](./docs/local-development.md)
- Production deployment: [docs/production-deployment.md](./docs/production-deployment.md)
- Database setup: [DATABASE_SETUP.md](./DATABASE_SETUP.md)

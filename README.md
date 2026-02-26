# MakerBench

MakerBench is a curated bookmarking platform for developer and maker tools.

## Requirements

- Node.js 24.x
- pnpm (unversioned by policy)

Runtime/package manager decision:

- Netlify Functions run on Node.js, so Bun is intentionally not part of this deployment workflow.

## Current Status (February 26, 2026)

Core MVP functionality is implemented:

- Submit a tool URL with tags
- Extract metadata (title/description/OG image)
- Capture screenshot fallback with Browserless when OG image is missing
- Store fallback screenshots in Cloudinary
- Persist bookmarks and tags in Turso (Drizzle ORM)
- Browse approved bookmarks
- Search approved bookmarks by title and tags
- Filter by tags with URL-synced state
- Responsive React UI with routing (`/`, `/submit`, `/about`, `/privacy`)

## Tech Stack

- React 19 + TypeScript + Vite
- Netlify Functions
- Turso (libSQL) + Drizzle ORM
- Zod validation
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

Copy `.env.example` to `.env` and fill values:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `BROWSERLESS_API_KEY`
- `SENTRY_DSN` (optional)

Package manager note: this repository intentionally uses unpinned `pnpm` (no specific pnpm version is enforced).

## API Endpoints

- `POST /api/bookmarks` - submit bookmark (stored as `pending`)
- `GET /api/bookmarks` - list approved bookmarks (paginated)
- `GET /api/bookmarks/search` - search/filter approved bookmarks

## Issue Tracking

This project now uses GitHub Issues (not beads/bd).

Open backlog is tracked at:
[https://github.com/schalkneethling/makerbench-next/issues](https://github.com/schalkneethling/makerbench-next/issues)

## Documentation

- Architecture: [docs/architecture.md](./docs/architecture.md)
- Local setup: [docs/local-development.md](./docs/local-development.md)
- Production deployment: [docs/production-deployment.md](./docs/production-deployment.md)
- Database setup: [DATABASE_SETUP.md](./DATABASE_SETUP.md)

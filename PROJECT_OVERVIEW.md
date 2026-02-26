# MakerBench Project Overview

## Vision

MakerBench is a moderated, community-driven directory of useful tools and resources for makers and developers.

## Current Implementation Snapshot (February 26, 2026)

## Implemented

- Frontend app with React Router and shared layout
- Pages: Home, Submit, About, Privacy, Not Found
- UI components for cards, alerts, forms, search, tags, pagination/loading
- API client + hooks for bookmarks, search, and submission
- Netlify Functions for submit/list/search flows
- Metadata extraction service (Cheerio)
- Screenshot service (Browserless) with Cloudinary upload
- Turso schema + migrations + query layer
- Zod validation on client and server boundaries
- Unit/component/function/e2e test suites in repo

## Not Yet Implemented

- Admin moderation API/UI for approving/rejecting pending submissions
- Authentication/authorization for admin workflows
- Algolia integration (still optional/planned)

## Architecture

## Frontend

- React 19, TypeScript, Vite
- CSS design token and utility layers
- `src/pages`, `src/components`, `src/hooks`, `src/api`

## Backend

- Netlify Functions under `netlify/functions`
- Shared function helpers in `netlify/functions/lib`
- Database access through Drizzle + Turso

## Data Model

- `bookmarks` (status: `pending | approved | rejected`, metadata/image fields)
- `tags`
- `bookmark_tags` (many-to-many, unique bookmark/tag pair)

## Runtime Flow

1. User submits URL + tags via `/submit`
2. `POST /api/bookmarks` validates and normalizes input
3. Metadata is extracted from target URL
4. If no OG image exists, Browserless screenshot is captured and uploaded to Cloudinary
5. Bookmark is stored as `pending`
6. Public listing/search endpoints return only `approved` bookmarks

## Environment Variables

Server-side variables expected by functions:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BROWSERLESS_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SENTRY_DSN` (optional)

## Known Operational Notes

- Because submissions default to `pending`, moderation capability is the main missing piece for fully closed-loop publishing.
- GitHub Issues is now the canonical tracker.

## References

- [README.md](./README.md)
- [ROADMAP.md](./ROADMAP.md)
- [DATABASE_SETUP.md](./DATABASE_SETUP.md)

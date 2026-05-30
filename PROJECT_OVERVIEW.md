# MakerBench Project Overview

## Vision

MakerBench is a moderated, community-driven directory of useful tools and resources for makers and developers.

## Current Implementation Snapshot (May 2026)

See [architecture.md](./architecture.md) for the full technical reference.

### Implemented

- Frontend app with React Router, shared layout, and Supabase OAuth
- Pages: Home/Tools, Resources, Library, Submit, About, Privacy, Not Found
- UI components for cards, alerts, forms, search, tags, pagination/loading
- API clients + hooks for tools, resources, library, search, and submission
- Netlify Functions for submit/list/search/library/auth flows
- Metadata extraction (Cheerio), screenshot fallback (Browserless), Cloudinary upload
- Supabase Postgres schema + Drizzle migrations
- Valibot validation on client and server boundaries
- Unit, component, function, and e2e test suites
- Storybook 10 with colocated component stories, MSW-backed preview, and Vitest browser tests (10 story files; pages/layout not yet covered)

### Storybook status (May 2026)

| Area                 | Status                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Config               | `.storybook/main.ts`, `preview.tsx`, `msw-handlers.ts`                                                            |
| Addons               | a11y, docs, Vitest, Chromatic, MCP                                                                                |
| Stories              | Button, Alert, LoadMoreButton, ResultCount, TagBadge, TagCloud, SearchInput, TagInput, ToolCard, ToolCardSkeleton |
| Not yet in Storybook | Pages, Header/Footer, ResourceCard, auth-heavy flows                                                              |

Commands: `pnpm storybook`, `npx vitest --project storybook run`

### Not Yet Implemented

- Unified admin moderation queue (tools, public resources, stacks, stack items) — see [#105](https://github.com/schalkneethling/makerbench-next/issues/105)
- Pagination totals on tool list/search endpoints — see [#106](https://github.com/schalkneethling/makerbench-next/issues/106)
- Full personal library parity (edit/delete, stacks, read status) — see [#64–#67](https://github.com/schalkneethling/makerbench-next/issues/64)

## Known Operational Notes

- Submissions default to `pending`; unified moderation is the main missing piece for closed-loop publishing across tools and public resources/stacks.
- GitHub Issues is the canonical tracker: [issues](https://github.com/schalkneethling/makerbench-next/issues)

## References

- [architecture.md](./architecture.md)
- [README.md](./README.md)
- [ROADMAP.md](./ROADMAP.md)
- [DATABASE_SETUP.md](./DATABASE_SETUP.md)

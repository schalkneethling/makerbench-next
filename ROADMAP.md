# MakerBench Roadmap

This roadmap reflects the codebase status as of May 2026.

## Completed

### Backend foundation

- Tool submission endpoint (`POST /api/tools`)
- Tool listing endpoint (`GET /api/tools`)
- Tool search endpoint (`GET /api/tools/search`)
- Tag listing endpoint (`GET /api/tools/tags`)
- Public resources endpoints (`GET /api/resources`, `GET /api/resources/search`)
- Personal library endpoints (`GET /api/library`, `POST /api/library`)
- Auth identity endpoint (`GET /api/auth/whoami`)
- Metadata extraction (Cheerio)
- Screenshot fallback (Browserless)
- Screenshot storage (Cloudinary)
- Supabase Postgres schema + Drizzle migrations + query helpers
- Valibot validation and structured error handling

### Frontend MVP

- Router, layout, and core pages (`/`, `/tools`, `/resources`, `/library`, `/submit`, `/about`, `/privacy`)
- Supabase OAuth sign-in (Google, GitHub) with header auth UI
- Submission form flow with validation and feedback
- Tool grid with loading/empty/error states
- Search and tag filtering with URL-synced state
- Personal library page (view + add)
- Core accessibility patterns and e2e coverage

## In Progress / Next Logical Milestone

### Phase 3: Moderation and publishing loop

Goal: close the loop between `pending` submissions and public visibility across all moderated content types.

Target outcomes:

- Add admin API endpoints for a unified review queue covering:
  - Tools (`tool_listings`)
  - Public resources (`public_listings`)
  - Stacks (`public_stacks`)
  - Stack items (`public_stack_items`)
- Add admin UI with approve/reject actions for each type
- Protect admin routes/actions with authentication
- Add tests for moderation workflows

Tracked in [#105](https://github.com/schalkneethling/makerbench-next/issues/105) (supersedes #69).

## Post-MVP Candidates

- Algolia-backed search
- AND/OR toggle for combined title + tag search (see open issue)
- AI-assisted “find similar” tool discovery
- Community features (votes/comments/digest)

## Notes

- GitHub Issues is the source of truth for task tracking.
- Architecture reference: [architecture.md](./architecture.md)
- Repository issues: [https://github.com/schalkneethling/makerbench-next/issues](https://github.com/schalkneethling/makerbench-next/issues)

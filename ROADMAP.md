# MakerBench Roadmap

This roadmap reflects the codebase status as of February 26, 2026.

## Completed

## Phase 1: Backend Foundation

- Bookmark submission endpoint (`POST /api/bookmarks`)
- Bookmark listing endpoint (`GET /api/bookmarks`)
- Bookmark search endpoint (`GET /api/bookmarks/search`)
- Metadata extraction (Cheerio)
- Screenshot fallback (Browserless)
- Screenshot storage (Cloudinary)
- Turso schema + migrations + query helpers
- Structured validation and error handling

## Phase 2: Frontend MVP

- Router, layout, and core pages
- Submission form flow with validation and feedback
- Bookmark grid with loading/empty/error states
- Search and tag filtering
- URL parameter sync for shared filter state
- Core accessibility patterns and e2e coverage

## In Progress / Next Logical Milestone

## Phase 3: Moderation and Publishing Loop

Goal: close the loop between `pending` submissions and public visibility.

Target outcomes:

- Add admin API endpoints for review queue and status transitions
- Add admin UI for approve/reject actions
- Protect admin routes/actions with authentication
- Add tests for moderation workflows

## Active GitHub Backlog

Current open issues migrated from prior tracker:

- #2 Fix search input label and placeholder text
- #3 Add URL state management for filters
- #4 Refactor to shared Input base component
- #5 Standardize interactive state styles (`:hover`, `:focus`, `:focus-visible`)
- #6 Consider dedicated Icon component to reduce style duplication
- #7 Widen search input on homepage
- #8 Clarify tag input instructions on submit page
- #9 Refactor typography defaults and utility classes
- #10 Tag badges in tool cards don't filter when clicked

Repository issues:
[https://github.com/schalkneethling/makerbench-next/issues](https://github.com/schalkneethling/makerbench-next/issues)

## Post-MVP Candidates

- Algolia-backed search
- User accounts and personal collections
- AI-assisted “find similar” tool discovery
- Community features (votes/comments/digest)

## Notes

- GitHub Issues is the source of truth for task tracking.
- Historical phase implementation documents remain for context but are no longer the active tracker.

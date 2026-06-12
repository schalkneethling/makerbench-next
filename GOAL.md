# Project Goal

## North Star

MakerBench exists to help developers and designers (makers) share and discover high-signal web tools, resources, and articles through clear tagging and powerful search, without turning discovery into an exhaustive or noisy directory.

## Who This Is For

- Developers, designers, makers, founders, and small teams looking for useful tools, articles, references, and resource stacks.
- Community contributors who want to submit resources for review.
- Signed-in users who want a private bookmark library connected to the same resource graph.
- Maintainers and admins who curate public listings and keep the catalog trustworthy.

## Core Goals

1. Provide a curated public catalog of approved tools and resources.
   - Support browsing, searching, tag filtering, and stable URL-synced discovery flows.
   - Keep public results limited to reviewed, approved content.
   - Preserve enough metadata, imagery, and tags for users to judge whether a resource is worth opening.

2. Make submissions useful without sacrificing quality.
   - Let people submit candidate tools and resources with a small, understandable form.
   - Extract metadata automatically and use screenshot fallback when open graph images are unavailable.
   - Route submissions through moderation instead of publishing directly.

3. Support private collecting for signed-in users.
   - Let authenticated users save resources to a personal library.
   - Keep personal bookmarks separate from public listings while reusing shared resource identity.
   - Build toward richer private library workflows such as read status, notes, stacks, and save-from-public-resource actions.

4. Give maintainers a reliable moderation loop.
   - Provide admin-only review workflows for tools, public resources, stacks, and stack items.
   - Record approve/reject decisions consistently.
   - Add abuse controls such as rate limiting and URL/domain blocklists before broader public submission increases moderation load.

5. Keep the implementation approachable for an open source project.
   - Favor clear React, Netlify Functions, Supabase Postgres, Drizzle, Valibot, and plain CSS patterns over unnecessary framework churn.
   - Keep API contracts typed and validated.
   - Use Storybook, Vitest, and Playwright coverage where it protects real behavior and accessibility.
   - Treat security as a first-class concern in product design, API behavior, data access, and public error messages.

## Success Looks Like

- A visitor can search or filter the public catalog and quickly find a relevant, trustworthy resource.
- A contributor can submit a resource and understand that it will be reviewed before publication.
- An admin can move pending submissions to approved or rejected states without touching the database directly.
- Approved tools appear on `/` and `/tools`; approved resources and stacks appear on `/resources`.
- Signed-in users can maintain a private library without confusing private bookmarks with public listings.
- The backlog, roadmap, docs, schema, tests, and app copy agree on the current product direction.
- New contributors and agents can infer where a change belongs and which quality gates to run.

## Non-Goals

- MakerBench is not trying to list every tool, article, or link on the internet.
- MakerBench is not a social network; votes are the only community signal currently worth considering, and comments, digests, feeds, or other social features are not part of the product direction.
- MakerBench is not an app marketplace, paid ranking system, or promotional listing service.
- MakerBench is not optimized for unmoderated publishing or maximum submission volume.
- MakerBench should not split articles, guides, and references into many user-facing submission types unless there is a clear product need; the current direction is a binary `tool` or `resource` model.
- MakerBench should not add infrastructure, search providers, or AI features before the moderation and publishing loop is reliable.
- MakerBench should not rely on UI-only validation or client-only trust for submissions, attribution, authentication, moderation, or abuse controls.

## Principles and Constraints

- GitHub Issues are the source of truth for active work; `ROADMAP.md` provides milestone context.
- Public catalog data is moderated. `pending | approved | rejected` status should remain central to public visibility.
- Supabase Postgres is the canonical data store; Drizzle schema and migrations must stay in sync, and production schema changes must land before dependent code.
- Valibot schemas define external input and response contracts. Avoid parallel hand-rolled validation.
- Netlify Functions are the API runtime. Node.js 24 and pnpm are the deployment baseline.
- Authenticated behavior uses Supabase Auth and server-side JWT verification.
- Security-sensitive behavior belongs on the server. Submissions, attribution, authentication, moderation, rate limiting, blocklists, and authorization must not depend on client-only checks.
- CSS stays plain and token-driven, with semantic HTML and accessibility as default requirements.
- Tests should protect project logic, API contracts, moderation/auth behavior, accessibility structure, and user flows rather than chase coverage for its own sake.

## Current Focus

The next major milestone is closing the moderation and publishing loop:

- Build a unified admin moderation queue for tools, public resources, stacks, and stack items.
- Broaden the submit flow from "Submit Tool" to one clear "Submit Resource" flow with a required `tool | resource` choice and auth-aware attribution.
- Add server-side submission protections, especially rate limiting and URL/domain blocklist enforcement.
- Continue aligning app copy and documentation after the Supabase migration.

## Open Questions

- The internal implementation path for non-tool resource submissions still needs to be designed, but the user-facing direction is one clear submission flow that routes `tool` and `resource` choices appropriately.
- Stale Turso setup and deployment docs are tracked in [#131](https://github.com/schalkneethling/makerbench-next/issues/131) and should not be treated as current product direction.

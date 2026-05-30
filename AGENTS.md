# Agent Instructions

Project-specific rules for agents. For system architecture, see [`architecture.md`](./architecture.md).

## Issue tracking

```bash
gh issue list         # Find available work
gh issue view <id>    # View issue details
gh issue create       # Create follow-up work
gh issue close <id>   # Complete work
```

GitHub Issues is the source of truth. See [`ROADMAP.md`](./ROADMAP.md) for milestone context.

## Collaboration

**Partnership, not order-taking.** Push back when a request contradicts established patterns or adds complexity without clear benefit.

**Questions ≠ change requests.** For "Can we…?" / "Should this…?": explain tradeoffs, share a recommendation, wait for confirmation before implementing.

## Process management

**Kill orphan processes before tests or dev servers:**

```bash
pkill -9 -f "vitest" 2>/dev/null
pkill -9 -f "playwright" 2>/dev/null
```

- **Tests:** `pnpm test` only (includes `--run`; never watch mode unless asked)
- **After tests:** verify no vitest/playwright/node orphans remain
- **Dev servers:** do not start in background unless requested; kill before session end
- **Storybook:** `pnpm storybook` for the workshop UI; `npx vitest --project storybook run` for story tests
- **Playwright:** `npx playwright test --project=chromium` for e2e; kill test servers after runs

## External APIs

Consult current docs (Context7 MCP or official URLs) before implementing. Do not guess at API behavior.

| Service | Purpose | Notes |
| --- | --- | --- |
| Browserless | Screenshots | `png`/`jpeg` only; `gotoOptions.waitUntil: "networkidle2"` |
| Cloudinary | Image delivery | Upload PNG; `f_auto,q_auto` at delivery |
| Supabase | Postgres + Auth | Server pooler URL for functions; anon key for JWT verify |

Details: [`architecture.md`](./architecture.md) · [Browserless screenshot API](https://docs.browserless.io/rest-apis/screenshot-api) · [Supabase docs](https://supabase.com/docs)

## Database migrations (Supabase Postgres)

**Schema must reach production before code that depends on new columns.**

1. Edit `src/db/schema.ts`
2. `pnpm db:generate` then `pnpm db:migrate`
3. Verify with `netlify dev`

**Gotchas:**

- Migrations are driven by `migrations/postgres/meta/_journal.json`, not SQL files alone — manual SQL without journal/snapshot is silently skipped
- Duplicate-object errors usually mean DB is ahead of Drizzle history; check `__drizzle_migrations` before rewriting schema

Env: `.env.schema` (Varlock). Local setup: [`docs/local-development.md`](./docs/local-development.md)

## TypeScript

- **Types:** Prefer official package/`@types` exports before custom `.d.ts` (e.g. `@netlify/types` for `Netlify` global)
- **Silencing:** Last resort only; every `@ts-expect-error` / `as any` needs an explanatory comment
- **Fix root cause** before suppressing

## Validation and API patterns

**Valibot only** — no hand-rolled validation. Schemas live in `src/lib/validation.ts`; infer types with `v.InferOutput`.

| Use Valibot | Use plain TS types |
| --- | --- |
| API bodies/responses, forms, env | Internal params/state |

**API clients** (`src/api/bookmarks.ts` is the reference):

- No try/catch in clients — throw typed errors (`BookmarkApiError`); hooks/components handle UX
- Parse `{ error, details }` on 4xx/5xx; validate success payloads (invalid shape = bug)
- Comment non-obvious throw paths so readers know errors propagate intentionally

**Libraries:** Use what dependencies provide (Valibot inference, Drizzle schema types) instead of parallel custom implementations.

## Accessibility

Prefer **`aria-labelledby`** + visually-hidden text over **`aria-label`** (translatable, inspectable). Exception: static non-translatable labels or third-party constraints.

Semantic HTML and WCAG apply globally — see `.cursor/rules/semantic-html.mdc` when structuring markup.

## CSS

Pure CSS, design tokens in `src/styles/tokens.css`, base styles in `src/styles/index.css`. Check existing styles before adding new rules.

- **Shared-first**, not mobile-first — bounded range queries: `(width < 48rem)`, `(width >= 48rem)`, etc.
- **Logical properties** — `padding-block`/`padding-inline`, `block-size`/`inline-size`; avoid directional shorthands with differing values
- **No vendor prefixes**
- **Combine duplicate selectors** into one rule block
- **Curly braces** on all control flow (`if`, `else`, loops)

Responsive/CSS patterns: `.cursor/rules/css-coder.mdc`

## Testing

Test **our logic**, not the platform or React. No coverage-for-coverage tests.

| Layer | Command | Notes |
| --- | --- | --- |
| Unit / component / function | `pnpm test` | Vitest; always `--run` in CI |
| Storybook interactions | `npx vitest --project storybook run` | Browser mode (Playwright); stories in `src/**/*.stories.tsx` |
| E2e | `npx playwright test --project=chromium` | ARIA snapshots for page structure |

**Playwright e2e:** use **`toMatchAriaSnapshot()`** for page/component structure — one assertion on the accessibility tree. Update snapshots when DOM structure changes; never ignore failing ARIA tests.

**Storybook:** colocated `*.stories.tsx` files; shared setup in `.storybook/preview.tsx` (app CSS, `AuthProvider`, `BrowserRouter`, MSW). New stories start with `tags: ['ai-generated']`; remove `'needs-work'` only after `npx vitest --project storybook run` passes for that file. Do not start Storybook in the background unless requested.

Workflow: change component → `npx playwright test --project=chromium` → fix snapshot or component → commit.

## React

React 19 · Vite SPA (not Next.js RSC). React Compiler enabled — avoid manual memoization unless profiling shows need.

**Before `useEffect`:** read [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect). Effects are for external sync (network, subscriptions, DOM listeners), not derived state or event-driven work.

| Instead of effect | Prefer |
| --- | --- |
| Derived display data | Compute in render |
| User actions | Event handlers |
| Prop-driven reset | `key` or render-time derivation |

**React 19:** prefer Actions/`useActionState` for forms, `use()` where appropriate, refs as regular props (no `forwardRef`). Skip Server Components guidance — not applicable here.

**Naming:** no single-letter variables except `a`/`b` in sort comparators.

## Code style

- JSDoc on functions/classes — concise, clear
- Search codebase before new components/styles; reuse tokens and patterns
- Barrel files (`index.ts` re-exports): curated public API only, not every directory

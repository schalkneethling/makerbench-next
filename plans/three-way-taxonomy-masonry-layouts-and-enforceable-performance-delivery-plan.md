# Three-way taxonomy, Masonry layouts, and enforceable performance delivery plan

## Summary

Implement Tools, Resources, and Articles as three first-class types through a sequence of small, independently reviewable issues and pull requests.

The work will also:

- Use `@schalkneethling/masonry-gridlanes-wc` for all public browse and personal-library card collections.
- Establish a reproducible production performance baseline before optimization.
- Commit sanitized baseline HAR evidence and upload subsequent HARs from CI.
- Enforce bundle, transfer, request-count, and runtime budgets.
- Run production performance scenarios on every pull request.
- Add native View Transitions for route navigation and deliberate catalog state changes.
- Preserve Valibot as the validation standard; no Zod migration is required.

## Research conclusions

### Pull-request structure

The linked [PR guidance](https://github.com/schalkneethling/schalkneethling.com/blob/main/PR.md) requires one primary review question per PR, independently mergeable behavior boundaries, and reassessment when a diff begins combining workflows.

Implementation will therefore use:

- One umbrella GitHub issue for the complete feature.
- One child issue and one issue branch per PR below.
- Each branch created from the latest `main` after its dependency merges.
- Tests and directly relevant documentation included with each behavior.
- No final catch-all PR containing unrelated cleanup.

### Masonry

`@schalkneethling/masonry-gridlanes-wc` 0.1.0 is the selected library. It is native-first, delegating to CSS Grid Lanes when supported and using a spec-shaped fallback elsewhere. Its repository has CI, Playwright coverage, and release automation. [Library documentation](https://github.com/schalkneethling/masonry-gridlanes-wc)

Final Masonry scope:

- Tool cards
- Resource cards
- Article cards
- Personal-library cards
- Their loading skeleton layouts

The admin moderation and classification queues remain native workflow lists. They contain forms and ordered review actions, and converting them would require replacing valid `<ul>/<li>` structure with ARIA list roles.

### Performance tooling

Adopt maintained tools rather than writing a replacement:

- **Playwright 1.60**, already installed, for production scenarios, HAR capture, and browser-side Performance API collection. Playwright 1.60 added first-class HAR tracing support. [Playwright release notes](https://playwright.dev/docs/release-notes)
- **Size Limit 13.0.1** with `@size-limit/file` for deterministic compressed build budgets. It was released on July 24, 2026 and is actively maintained. [Size Limit repository](https://github.com/ai/size-limit)

Do not add Lighthouse CI initially. Playwright plus native Performance APIs provide the required scenario coverage, while Size Limit provides stable build enforcement.

The repository currently has Playwright packages but no installed Chromium binary. The performance workflow must explicitly run:

```bash
npx playwright install --with-deps chromium
```

and fail with a clear setup message when Chromium is unavailable.

### Validation

MakerBench does not use Zod for first-party data validation:

- `valibot` is the direct application dependency.
- Shared request schemas, frontend form validation, API response parsing, authentication clients, library APIs, submissions, blocklists, moderation, and rate-limit configuration already use Valibot.
- The lockfile’s Zod packages are transitive dependencies of `eslint-plugin-react-hooks`; application code does not import them.

Therefore:

- Do not file a Zod-to-Valibot migration issue.
- Do not file a broad “introduce validation” issue.
- Replace hand-written query parsing in touched endpoints with Valibot.
- Refine existing issue #76 so remaining pagination/query parsing is explicitly migrated to shared Valibot schemas.

## Pull-request sequence

### PR 1 — Reproducible production performance baseline

**Primary review question:** Can MakerBench’s current production behavior be measured reproducibly without storing sensitive data?

Add a Playwright-based production measurement harness targeting:

```text
https://makerbench.schalkneethling.com
```

Capture five fresh browser contexts for desktop and five for mobile. Each context runs:

1. Cold `/` load.
2. Warm `/` reload.
3. Tool text search.
4. Tool tag selection when tags exist.
5. SPA navigation to `/resources`.
6. Resource search.
7. Resource sort change.
8. SPA navigation to `/submit`.
9. Switching between the currently available submission types without submitting data.

Use deterministic, non-sensitive search strings such as `css`, `design`, and `accessibility`.

For each scenario, collect with native browser APIs:

- `PerformanceNavigationTiming`
- `PerformanceResourceTiming`
- `PerformancePaintTiming`
- LCP through `PerformanceObserver`
- CLS through buffered `layout-shift` entries
- Event timing for synthetic interactions
- Long tasks or Long Animation Frames when supported
- Custom scenario marks and measures injected by Playwright

The Performance API exposes navigation, resource, paint, custom mark/measure, event, LCP, layout-shift, and server-timing entries. [MDN Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API)

HAR handling:

- Record with response bodies omitted.
- Retain timing, URL, method, status, MIME type, transfer size, cache headers, `Cache-Status`, and `Server-Timing`.
- Strip cookies, authorization, API keys, tokens, and all non-allowlisted request/response headers.
- Validate the sanitized HAR before writing it.
- Commit compressed baseline artifacts under:

```text
performance/baselines/2026-07-26/
  pre-taxonomy-desktop.har.zip
  pre-taxonomy-mobile.har.zip
  summary.json
  summary.md
```

- Never overwrite a baseline automatically.
- Subsequent captures go to a gitignored artifact directory.

### PR 2 — Performance budgets and pull-request CI

**Primary review question:** Do automated checks reliably prevent known performance regressions?

Add:

```text
performance/budgets.json
performance/README.md
.size-limit.json
.github/workflows/performance.yml
```

Package scripts:

```json
{
  "performance:capture": "...",
  "performance:budget": "...",
  "performance:production": "...",
  "performance:baseline": "..."
}
```

Initial deterministic Size Limit budgets, based on the current build:

| Asset group      | Current Brotli | Initial budget |
| ---------------- | -------------: | -------------: |
| Entry JavaScript |  129,857 bytes |         130 kB |
| Entry CSS        |    5,392 bytes |           7 kB |
| All JavaScript   |        ~134 kB |         150 kB |
| All CSS          |        ~6.1 kB |           8 kB |

Enable Vite’s build manifest so entry and lazy chunks are identified by role rather than guessed solely from hashed filenames.

Budget policy:

- Budgets may be lowered in ordinary feature PRs.
- Raising a budget requires a dedicated issue and PR containing measurement evidence and an explanation.
- Dependency updates may not silently reset baselines.
- Route splitting PRs must ratchet the entry budget downward to the measured post-split size.

Runtime budgets are fixed in `performance/budgets.json` after PR 1:

- Use the slower of the current p75 plus 15% or the recognized “good” threshold so the first check passes without inventing unattainable numbers.
- Ratchet toward the good threshold after improvements.
- Never automatically replace the baseline with the latest run.

Core goals:

- LCP ≤ 2.5 seconds
- INP ≤ 200 milliseconds
- CLS ≤ 0.1

These are the current recommended Core Web Vitals thresholds, evaluated at the 75th percentile. [web.dev Web Vitals](https://web.dev/articles/vitals)

Every pull request runs:

1. Install and build.
2. Size Limit budgets.
3. Local production-build request/transfer budgets.
4. Five desktop and five mobile runs against current production.
5. p75 assertions.
6. HAR capture on every run.
7. Artifact upload even when the job fails.

Production unavailability fails the job after bounded retries, matching the chosen strict PR policy.

### PR 3 — Reduce startup JavaScript

**Primary review question:** Does the initial Tool route load less JavaScript without changing behavior?

- Lazy-load Resources, Articles placeholder, Submit, Library, About, Privacy, Not Found, and all admin pages.
- Keep the Tool homepage eager.
- Move the Supabase client behind a dynamic import used by auth synchronization and auth actions.
- Public cards must not wait for auth initialization.
- Add accessible route-loading fallbacks.
- Compare and ratchet the entry JavaScript budget downward.
- Verify lazy route modules are absent from the initial Tool dependency graph.

### PR 4 — Masonry foundation and Tool cards

**Primary review question:** Does the shared Masonry integration correctly render image-rich Tool cards in native and fallback modes?

Install the Masonry package and add a shared React wrapper.

Initialization:

```ts
import {
  adoptMasonryGridLanesStyles,
  defineMasonryGridLanes,
} from "@schalkneethling/masonry-gridlanes-wc";
```

- Register the custom element once.
- Adopt its styles once before card layout is exposed.
- Add a narrowly typed JSX custom-element declaration if the package does not provide one.
- Use logical layout properties and MakerBench tokens.

Tool configuration:

```html
<masonry-grid-lanes min-column-width="288" gap="24"></masonry-grid-lanes>
```

- Use DOM measurement because Tool cards contain images and variable rich markup.
- Render Tool skeletons through the same host with stable dimensions.
- Preserve DOM/focus order.
- Add Storybook cases for image, fallback image, long text, tags, and skeleton replacement.
- Validate native Grid Lanes and JavaScript fallback behavior.
- Measure the dependency’s effect against the enforced bundle budget.

### PR 5 — Personal-library Masonry layout

**Primary review question:** Can personal-library cards use Masonry without regressing access, focus order, or variable notes/tags?

- Replace `LibraryPage-grid` with the shared Masonry host.
- Use DOM measurement because notes, descriptions, and tag collections produce variable rich content.
- Use the custom element as `role="list"` and direct card wrappers as `role="listitem"`, because `<li>` cannot validly be a direct child of the custom element.
- Preserve the existing Saved Resources heading and accessible relationship.
- Add long-note, no-note, many-tag, and narrow-viewport tests.

### PR 6 — Resource/Article database indexes

**Primary review question:** Do the indexes support category-specific browse and search queries?

Add Drizzle-managed indexes for:

- `status`, `content_kind`, `created_at DESC`, `id`
- A title-oriented functional index only if representative query plans use it

Run `EXPLAIN (ANALYZE, BUFFERS)` for:

- Resource newest/oldest
- Article newest/oldest
- Alphabetical sorting
- Tag-only filtering
- Text search plus content kind

Apply the migration to production before dependent query changes.

### PR 7 — Additive Resource and Article read APIs

**Primary review question:** Can Resources and Articles be fetched independently with correct server-side filtering, ordering, and pagination?

Add shared Valibot schemas for:

```ts
type PublicListingKind = "resource" | "article";
type PublicListingSort = "newest" | "oldest" | "alpha-asc" | "alpha-desc";
```

Validated query contract:

```ts
{
  kind?: PublicListingKind;
  q?: string;
  tags?: string[];
  sort?: PublicListingSort;
  limit?: number;
  offset?: number;
}
```

Add:

- `GET /api/articles`
- `GET /api/articles/tags`
- `GET /api/resources/tags`
- `kind=resource` support to `/api/resources`

During this additive PR:

- Existing `/api/resources` without `kind` retains its current response for compatibility.
- The new filtered path returns only `public_listings`.
- Article queries return only `content_kind = article`.
- Resource queries return only `content_kind = resource`.
- Filtered paths never query stacks or stack children.
- Use `limit + 1` rather than an exact count.
- Return `total: null`.
- Apply all sorting in PostgreSQL with stable ID tie-breaking.
- Derive complete tag facets from the requested approved kind.

### PR 8 — Shared public-listing client and hook

**Primary review question:** Does one client-side data flow avoid duplicate initial requests and stale updates?

Add a shared validated client and:

```ts
usePublicListings({
  kind,
  query,
  tags,
  sort,
});
```

It must:

- Make one initial card-data request.
- Use URL filters in that first request.
- Never fetch unfiltered data before a filtered deep link.
- Abort superseded requests.
- Invalidate request IDs on dependency changes and unmount.
- Debounce text search.
- Apply tags and sorting immediately.
- Append load-more results using the active parameters.
- Load tag facets after the first card-render opportunity.
- Reuse shared API error/query plumbing rather than duplicating Resource and Article clients.

The hook may land with focused tests before the UI consumes it.

### PR 9 — Three public destinations and listing Masonry

**Primary review question:** Can users browse Tools, Resources, and Articles as three distinct destinations?

Routes:

- `/` and `/tools` → Tools
- `/resources` → Resources
- `/articles` → Articles

Header:

- Tools
- Resources
- Articles
- Library when authenticated
- Submit

Use route-aware links with `aria-current="page"`.

Create shared `PublicListingsPage`, `ListingCard`, and `ListingGrid` components.

Resource/Article Masonry:

```html
<masonry-grid-lanes
  min-column-width="320"
  gap="24"
  text-metrics="pretext"
></masonry-grid-lanes>
```

- Calibrate Pretext typography/chrome variables against real Listing cards.
- Use `sampleTextMetricsFromElement` during calibration.
- Test cards with/without descriptions and tags.
- If measured placement error exceeds one text line at supported breakpoints, remove `text-metrics="pretext"` and use the library’s DOM-measurement path; do not revert to CSS Grid.
- Empty states remain outside the Masonry host.
- Loading skeletons use the Masonry host.

Pages:

- Resources: curated collections and directories.
- Articles: essays, guides, PDFs, and other substantial writing.
- Search, tags, sort, pagination, result copy, and errors are category-specific.

### PR 10 — Remove Stacks from public APIs

**Primary review question:** Are Stacks completely absent from public browse/search contracts while remaining safely stored?

- Change `/api/resources` default behavior to Resources only.
- Keep `/api/resources/search` as a one-release deprecated Resource-only wrapper.
- Remove public Stack unions and stack-child hydration.
- Remove `stack` and `children` from public client schemas and Listing-card rendering.
- Preserve stack database tables, rows, RLS, and admin moderation.
- Update public API tests to assert that Stacks cannot be returned even through explicit query manipulation.

### PR 11 — Article-aware moderation

**Primary review question:** Can admins distinguish and review Resource and Article rows safely?

Extend moderation types:

```ts
"tool" | "resource" | "article" | "stack" | "stack-item";
```

- Select `public_listings.content_kind` instead of hard-coding Resource.
- Add an Articles moderation filter.
- Guard review updates by both row ID and expected content kind.
- Permit an admin-selected target Resource/Article kind during approval.
- Update classification and moderation status atomically.
- Retain Stack and Stack-item moderation.

### PR 12 — Article submission server contract

**Primary review question:** Does the server accept Article submissions without changing Tool/Resource safety behavior?

Change:

```ts
type PublicSubmissionType = "tool" | "resource" | "article";
```

- Article inserts into `public_listings` with `content_kind = article`.
- Resource inserts with `content_kind = resource`.
- Tool behavior remains unchanged.
- Resource and Article submissions skip screenshots and Cloudinary.
- Duplicate detection remains cross-kind.
- SSRF protection, rate limiting, attribution, blocklisting, metadata extraction, transaction locking, and pending status remain unchanged.
- Keep `/api/tools` tool-only.

### PR 13 — Three-way submission UI

**Primary review question:** Can contributors accurately choose between Tool, Resource, and Article?

Render three accessible radio cards:

- Tool — software or a service used to do a job.
- Resource — a collection or directory of useful items.
- Article — one piece of writing, including an essay, guide, or PDF.

Use:

- One column on narrow screens.
- Three columns at the existing desktop breakpoint.
- Type-specific URL placeholders.
- “Submit for review” as the action.
- “Submitted for review” as the success wording.

Update ARIA snapshots, component tests, and form validation.

### PR 14 — Existing catalog classification UI

**Primary review question:** Can admins safely correct existing Resource/Article classifications?

Add:

- `/admin/catalog`
- `GET /api/admin/catalog`
- `PATCH /api/admin/catalog`

Support approved/pending/rejected status, Resource/Article kind, search, and pagination.

- Only Resource ↔ Article changes are allowed.
- Do not infer classification from URLs, metadata, extensions, or AI.
- Reclassification of approved items triggers later cache invalidation.
- Perform the one-time existing catalog audit through this UI after deployment.

### PR 15 — Durable public caching and invalidation

**Primary review question:** Are cached public results fast, correctly keyed, and invalidated after catalog changes?

For successful unfiltered browse/facet responses:

```http
Netlify-CDN-Cache-Control: public, durable, max-age=60, stale-while-revalidate=300
Netlify-Cache-Tag: makerbench-public-catalog
```

Do not cache:

- Search responses
- Validation errors
- Server errors
- Authenticated/admin responses

After approval or approved-item reclassification:

```ts
await purgeCache({ tags: ["makerbench-public-catalog"] });
```

- Purge after the database transaction.
- Observe purge failures without rolling back successful moderation.
- Surface DB and handler durations through `Server-Timing`.
- Confirm Edge/Durable hits in production HARs.

### PR 16 — Native View Transitions

**Primary review question:** Do native transitions improve orientation without delaying interaction or ignoring reduced-motion preferences?

Use React Router’s existing native integration:

```tsx
<NavLink viewTransition to="/articles">
```

Apply it to primary route navigation and other deliberate route links.

For same-page catalog changes:

- Use a small feature-detected wrapper around `document.startViewTransition()`.
- Transition discrete tag, sort, and clear-filter result replacements after new data arrives.
- Do not transition every search keystroke.
- Do not transition load-more appends.
- Do not delay network requests to begin an animation.
- Use one restrained catalog-grid crossfade/repositioning treatment.
- Fall back to immediate state updates when unsupported.

Disable animations under:

```css
@media (prefers-reduced-motion: reduce) {
  /* view-transition animations: none */
}
```

The browser API now supports same-document SPA transitions and has a direct non-support fallback. [MDN View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)

Add Playwright coverage for:

- Supported transitions
- Unsupported API fallback
- Reduced motion
- Focus preservation
- Back/forward navigation
- Rapid filter changes
- Masonry relayout during a transitioned result replacement

## Performance marks added during implementation

Add a small platform-only helper that uses `performance.mark()` and `performance.measure()` when available.

Stable names:

```text
makerbench:app-bootstrap-start
makerbench:app-rendered
makerbench:catalog-request-start
makerbench:catalog-response
makerbench:catalog-cards-rendered
makerbench:tag-facets-request-start
makerbench:tag-facets-rendered
makerbench:route-transition-start
makerbench:route-transition-finished
```

Rules:

- Use monotonic Performance API timing, not `Date.now()`.
- Clear superseded marks/measures to prevent unbounded timeline growth.
- Do not send telemetry externally as part of this work.
- Playwright reads the entries directly.
- Add corresponding `Server-Timing` fields for database and handler work.

## Performance acceptance criteria

Every final public browse page must satisfy:

- One card-data request before first cards render.
- No unfiltered request before a filtered deep-link request.
- Tag facets begin after the card-render opportunity.
- Resource/Article browse queries use one DB statement.
- No count, Stack, or stack-child query occurs.
- Entry JavaScript stays within the ratcheted Size Limit budget.
- Public cards and library cards use the Masonry library in both native and fallback browsers.
- Production p75 does not regress more than 15% from the committed baseline.
- LCP, INP, and CLS meet their good thresholds or have an explicitly ratcheted issue tracking the remaining gap.
- Every PR uploads sanitized production HARs and summary JSON.

## Validation and test matrix

Run focused tests with every PR and the full gates before each PR is requested for review:

```bash
pnpm test
pnpm lint
pnpm lint:css
pnpm typecheck
pnpm build
pnpm performance:budget
npx vitest --project storybook run
npx playwright test --project=chromium
```

Additional required scenarios:

- Tool/Resource/Article submission schema acceptance.
- Stack submission rejection.
- Cross-kind duplicate detection.
- Approved-only browse behavior.
- Resource/Article isolation.
- Stack exclusion.
- Server-side sort correctness.
- Deferred complete tag facets.
- One-request filtered deep links.
- Masonry native/fallback layout.
- Masonry narrow viewport and load-more.
- Library notes/tags Masonry.
- Admin Article moderation.
- Approved-item reclassification.
- Cache header eligibility and purge behavior.
- Native View Transition and reduced-motion behavior.
- Performance budget pass/fail fixture tests.
- HAR sanitizer tests proving sensitive fields cannot survive.

Kill Vitest, Playwright, and test-server orphans before and after relevant runs.

## Documentation policy

Update documentation in the PR that changes the behavior:

- `GOAL.md`
- `architecture.md`
- `README.md`
- `ROADMAP.md`
- Production deployment guidance
- Performance baseline/budget documentation
- API deprecation notes

Do not defer all documentation to a final oversized PR.

## Final assumptions

- `/` remains the Tool homepage.
- Tools, Resources, and Articles are equal navigation destinations.
- Stacks remain stored and administrable but are excluded from public APIs.
- Browse and library card collections use Masonry; admin workflow lists do not.
- Resource/Article cards use Pretext only when calibration proves accurate.
- Production performance checks run and enforce thresholds on every pull request despite external-network variance.
- The initial sanitized HAR baselines are committed; later CI HARs are workflow artifacts.
- No first-party Zod migration issue is needed.
- Existing Valibot coverage is retained and expanded to touched query contracts.
- Performance budgets can only be raised through a dedicated evidence-backed PR.

# Agent Instructions

This project uses **GitHub Issues** for issue tracking.

## Quick Reference

```bash
gh issue list         # Find available work
gh issue view <id>    # View issue details
gh issue create       # Create follow-up work
gh issue close <id>   # Complete work
```

## Collaboration Style

**This is a partnership, not order-taking.**

### Push Back When Appropriate

- If a request contradicts existing patterns, explain why the code was written that way
- If a suggestion would introduce complexity without clear benefit, say so
- If context was likely missed, provide it before making changes

### Questions ≠ Change Requests

When the user asks "Can we...?" or "Should this...?" - treat it as a discussion:

1. **Explain tradeoffs** - present options with pros/cons
2. **Share your recommendation** - but don't assume it's the final word
3. **Wait for confirmation** before implementing changes

### Good Collaboration

- Bounce ideas back and forth
- Neither party is always right
- Curiosity questions deserve thoughtful answers, not immediate code changes

## Landing the Plane (Session Completion)

**When ending a work session or if the user asks you to wrap up the session please**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work and open follow-up issues as needed
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Process Management

**CRITICAL: Zombie node processes drain system resources. Be proactive, not reactive.**

### Kill Before You Run

**ALWAYS check for and kill orphan processes BEFORE running tests or starting servers:**

```bash
pkill -9 -f "vitest" 2>/dev/null
pkill -9 -f "playwright" 2>/dev/null
```

This prevents process accumulation across test runs. Vitest workers often zombie when sandbox restrictions interrupt cleanup.

### Running Tests

- **Always use `pnpm test`** (includes `--run` flag) - exits after completion
- **Never start vitest in watch mode** unless explicitly requested
- **After each test run**, verify cleanup: `ps aux | grep vitest | grep -v grep | wc -l` should be 0

### Dev Servers

- **Never start dev servers in background** unless explicitly requested
- If a background server is started, **kill it before session ends**

### Playwright

- **Never leave Playwright test-servers running** after tests complete
- Kill lingering processes: `pkill -f "playwright/test/cli.js"`

### Before Ending Session

Verify no orphan processes:

```bash
ps aux | grep -E "node|vitest|playwright" | grep -v grep
```

Kill any lingering processes from this workspace before handing off.

## External APIs and Services

**ALWAYS consult up-to-date documentation** when working with external APIs and services. Do NOT make assumptions about best practices or available features.

### Documentation First

1. **Use MCP Context7** to fetch current documentation:

   ```
   mcp_context7_resolve-library-id  # Find library ID
   mcp_context7_get-library-docs    # Get current docs
   ```

2. **Verify implementation** against official docs before finalizing
3. **Include doc references** in code comments for complex integrations

### Current External Services

| Service     | Purpose                | Doc Reference                                        |
| ----------- | ---------------------- | ---------------------------------------------------- |
| Browserless | Screenshot capture     | https://docs.browserless.io/rest-apis/screenshot-api |
| Cloudinary  | Image storage/delivery | https://cloudinary.com/documentation                 |
| Turso       | SQLite database        | https://docs.turso.tech                              |

### Key Implementation Notes

- **Browserless**: Only supports `png`/`jpeg` (not WebP). Use `gotoOptions.waitUntil: "networkidle2"` for reliable captures.
- **Cloudinary**: Upload source format (PNG), use `f_auto,q_auto` at delivery for WebP/AVIF optimization.

**When in doubt, consult the documentation.**

## Database Migrations (Turso)

**CRITICAL: Schema changes must be pushed to Turso before deploying code that depends on them.**

### Development Setup

1. Copy `.env.example` to `.env` and fill in Turso credentials
2. Push schema to database: `npx drizzle-kit push`

### When Schema Changes

After modifying `src/db/schema.ts`:

1. Generate migration: `npx drizzle-kit generate`
2. Push to Turso: `npx drizzle-kit push`
3. Verify locally with `netlify dev` before deploying

### Production Deployment

**Before deploying code with schema changes:**

1. Ensure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set in Netlify environment variables
2. Run `npx drizzle-kit push` against production database
3. Then deploy the code

**Order matters:** Database schema must be updated BEFORE code that uses new columns is deployed, or requests will fail with "table has no column" errors.

## TypeScript Type Declarations

**CRITICAL: NEVER create custom `.d.ts` files without first checking for official types.**

### Before Creating Type Declarations

1. **Check if package ships types** - Look for `types` or `typings` in `package.json`
2. **Check for `@types/*` package** - Run `pnpm info @types/<package-name>`
3. **Check transitive dependencies** - Types may be in a dependency (e.g., `@netlify/types` ships with `@netlify/functions`)
4. **Search package exports** - Look for exported type interfaces to use with `declare global`

### When Official Types Exist

```typescript
// GOOD: Import from official package
import type { NetlifyGlobal } from "@netlify/types";
declare global {
  const Netlify: NetlifyGlobal;
}

// BAD: Manual type definition
declare const Netlify: {
  env: { get: (key: string) => string | undefined };
};
```

### Only Create Custom Types When

- No official types exist after thorough search
- You've verified with documentation and npm registry
- Document WHY custom types were necessary in the file

## TypeScript Silencing

**CRITICAL: Be EXTREMELY cautious when silencing TypeScript errors.**

TypeScript exists to help write better, less brittle code. Silencing it should be a last resort, not a convenience.

### Rules

1. **Prefer fixing the root cause** - If TypeScript complains, the code likely needs improvement
2. **Use proper types first** - Import/define correct types before considering suppression
3. **ALWAYS document why** - Every `@ts-ignore`, `@ts-expect-error`, or `as any` MUST have an explanatory comment

### When Suppression is Acceptable

- Third-party library type bugs (document the issue link)
- Complex mocking scenarios where types are impractical
- Transition code with a TODO to fix later

### Required Comment Format

```typescript
// @ts-expect-error - Library types don't match runtime behavior, see https://github.com/...
someCall();

// Using 'as unknown as X' because mock doesn't implement full interface
const mock = mockFn() as unknown as FullInterface;
```

### Never Do This

```typescript
// BAD: Silent suppression with no explanation
// @ts-ignore
someCall();

// BAD: Lazy any cast
const data = response as any;
```

## Leverage Library Strengths

**CRITICAL: Use the full power of the libraries we depend on.**

Adding a dependency without leveraging its strengths wastes the opportunity and bloats the bundle for little gain. Before writing custom code, check if the library already provides the feature.

### Principle

If a library offers a capability, use it. Don't maintain parallel implementations.

### Example: Zod Type Inference

```typescript
// BAD: Duplicate definitions to maintain
const bookmarkSchema = z.object({
  id: z.string(),
  title: z.string(),
});

interface Bookmark {
  // Redundant! Will drift out of sync
  id: string;
  title: string;
}

// GOOD: Single source of truth
const bookmarkSchema = z.object({
  id: z.string(),
  title: z.string(),
});

type Bookmark = z.infer<typeof bookmarkSchema>; // Always in sync
```

### When to Use Zod Schemas vs Plain Types

| Scenario                          | Approach                                                  |
| --------------------------------- | --------------------------------------------------------- |
| API response data                 | Zod schema + `z.infer` (needs runtime validation)         |
| External input (forms, user data) | Zod schema + `z.infer` (needs runtime validation)         |
| Function parameters (internal)    | Plain TypeScript interface (no runtime validation needed) |
| Internal state shapes             | Plain TypeScript interface                                |

## API Client Error Handling Pattern

**Throw typed errors, let consumers handle them.**

### Principles

1. **No try/catch in API clients** - Throw `BookmarkApiError`, let React hooks/components decide how to handle
2. **Extract structured errors when possible** - Our API returns `{ error, details }` for known errors
3. **Fall back to generic for unexpected** - Network issues, malformed responses get generic message

### Pattern

See `src/api/bookmarks.ts` for the reference implementation. Key elements:

- `throwApiError(json, status)` - Extracts structured error or falls back to generic
- HTTP error → call `throwApiError`
- HTTP success → validate response shape, throw if invalid (indicates a bug)

### Why This Works

- **We control the API** - Our endpoints return structured JSON errors for known cases (validation, conflicts)
- **HTTP status aligns with body** - 4xx/5xx always has `{ success: false }`, 2xx has `{ success: true }`
- **Structured errors preserve details** - A 422 includes which fields failed, useful for UI display
- **Generic fallback for truly unexpected** - Network failures, malformed responses

### Comments Are Critical

This pattern can confuse readers. Always include comments explaining:

- Why we parse error bodies (to extract structured details)
- Why success validation throws (it indicates a bug)
- That errors propagate intentionally (consumers handle them)

## Validation

**CRITICAL: NEVER write custom validation logic - use Zod.**

### Always Use Zod For

- API request/response validation
- Form data validation
- Environment variable validation
- Any data shape verification

### Benefits

- Type inference from schemas (no duplicate type definitions)
- Consistent error formatting
- Composable and reusable schemas
- Runtime + compile-time safety

### Pattern

```typescript
// Define schema once
export const bookmarkRequestSchema = z.object({
  url: z.string().url().max(2000),
  tags: z.array(z.string().min(1).max(50)).min(1).max(10),
});

// Infer type from schema
export type BookmarkRequest = z.infer<typeof bookmarkRequestSchema>;

// Validate with safeParse
const result = bookmarkRequestSchema.safeParse(data);
if (!result.success) {
  return formatErrors(result.error.issues);
}
```

### Never Do This

```typescript
// BAD: Manual validation
if (!data.url || typeof data.url !== "string") {
  errors.url = ["URL is required"];
} else if (data.url.length > 2000) {
  errors.url = ["URL too long"];
}
```

Existing schemas are in `src/lib/validation.ts` - extend them, don't reinvent.

## Accessible Labels: Prefer aria-labelledby over aria-label

**Use `aria-labelledby` with visually-hidden text instead of `aria-label`.**

### Why

- Text is in the DOM (not just an attribute)—more maintainable
- Automated translation tools can find and translate it
- Screen readers handle it more consistently
- Easier to debug/inspect

### Pattern

```tsx
// GOOD: Visible text referenced by ID
<button aria-labelledby="remove-tag-1">
  <span id="remove-tag-1" className="visually-hidden">Remove JavaScript</span>
  ×
</button>

// BAD: String hidden in attribute
<button aria-label="Remove JavaScript">×</button>
```

### When aria-label is Acceptable

- Truly static, non-translatable labels
- Third-party components where you can't add DOM elements

## CSS: No Vendor Prefixes

**CRITICAL: NEVER use vendor prefixes.**

Modern CSS features are well-supported. Use standard properties only - build tools or browsers handle prefixing if needed.

### Never Do This

```css
/* BAD: Vendor prefixes */
-webkit-box-orient: vertical;
-webkit-line-clamp: 2;
display: -webkit-box;
```

### Use Standard Properties

```css
/* GOOD: Standard property */
line-clamp: 2;
overflow: hidden;
```

Note: `line-clamp` requires `overflow: hidden` to clip content; otherwise only the ellipsis shows.

If a feature requires vendor prefixes, it's likely not ready for production or there's a standard alternative.

## CSS: Combine Duplicate Selectors

When multiple selectors share identical styles, combine them into a single rule block.

```css
/* BAD: Duplicate style blocks */
.SearchInput-iconSvg {
  block-size: var(--size-20);
  display: block;
  inline-size: var(--size-20);
}

.SearchInput-clearIcon {
  block-size: var(--size-20);
  display: block;
  inline-size: var(--size-20);
}

/* GOOD: Combined selectors */
.SearchInput-iconSvg,
.SearchInput-clearIcon {
  block-size: var(--size-20);
  display: block;
  inline-size: var(--size-20);
}
```

## CSS: Logical Properties

**CRITICAL: Use logical properties instead of physical shorthand properties.**

Shorthand properties like `padding: X Y` and `margin: X Y` map to physical directions (top/right/bottom/left), which don't adapt for RTL languages or vertical writing modes.

### Always Use

```css
/* GOOD: Logical properties */
padding-block: var(--size-12);
padding-inline: var(--size-16);
margin-block-start: var(--size-8);

/* Also use logical sizing */
block-size: 100%;
inline-size: auto;
min-block-size: 100dvh;
```

### Exception: Uniform Values

When all sides have the same value, shorthand is fine—directional mapping doesn't matter:

```css
/* OK: Single value applies uniformly */
padding: var(--size-16);
margin: var(--size-8);
```

### Never Do This

```css
/* BAD: Physical shorthands with different values */
padding: var(--size-12) var(--size-16);
margin: var(--size-8) 0;
height: 100%;
width: auto;
```

## CSS: Shared First Approach

**CRITICAL: Use Shared First CSS, NOT mobile-first.**

Reference: https://www.mgrossklaus.de/notes/2023-02-18-mobile-first-versus-shared-first-css/

### Why Not Mobile First

Mobile-first `min-width` queries "bleed up" - changes to mobile styles affect larger viewports unless explicitly overridden. This is error-prone and creates debugging headaches (lots of struck-through properties in DevTools).

### Shared First Rules

1. **Define only shared styles outside media queries** - styles that apply to ALL viewports
2. **Use bounded queries** - scope viewport-specific styles to exact ranges
3. **Use modern range syntax** - `(width < 48rem)` not `(max-width: 47.99rem)`

### Standard Breakpoints

```css
@media (width < 48rem) /* < 768px - mobile */ @media (width >= 48rem) /* >= 768px - tablet+ */ @media (width >= 64rem) /* >= 1024px - desktop+ */ @media (width >= 100rem); /* >= 1600px - wide (occasional) */
```

### Pattern: Standard

```css
.Component {
  display: flex;
}

@media (width < 48rem) {
  .Component {
    flex-direction: column;
    gap: var(--size-16);
  }
}

@media (width >= 48rem) {
  .Component {
    flex-direction: row;
    gap: var(--size-32);
  }
}
```

### Pattern: Scoped Custom Properties

Use sparingly when the same property changes across breakpoints. Readability is paramount.

```css
.Component {
  display: flex;
  flex-direction: var(--Component-flex-direction);
}

@media (width < 48rem) {
  .Component {
    --Component-flex-direction: column;
    gap: var(--size-16);
  }
}

@media (width >= 48rem) {
  .Component {
    --Component-flex-direction: row;
    gap: var(--size-32);
  }
}
```

### Never Do This

```css
/* BAD: Mobile-first - styles bleed up */
.Component {
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 48rem) {
  .Component {
    flex-direction: row; /* Must override mobile */
    gap: 2rem; /* Must override mobile */
  }
}
```

## Build on Existing Foundations

**CRITICAL: Always check for existing styles, components, and patterns before writing new ones.**

Duplication creates maintenance burden, inconsistency, and technical debt. Every new style or component should build on what already exists.

### Before Writing New Code

1. **Search the codebase** - Check `src/styles/` for base styles, `src/components/` for existing components
2. **Understand the layer system** - Base styles in `index.css` apply globally; only add component-specific overrides
3. **Reuse design tokens** - Use `var(--token)` values from `tokens.css`, never hardcode values

### Example: Link Styling

Base link styles already exist in `src/styles/index.css`:

```css
a {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 0.15em;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--color-primary-hover);
}
```

```css
/* BAD: Duplicating base styles in component */
.MyComponent-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: var(--size-4);
}

/* GOOD: Only add what's unique to this component */
.MyComponent-link {
  font-weight: var(--font-weight-bold);
}
```

### Composable Components

Build components that:

- **Inherit sensible defaults** - Leverage base styles and design tokens
- **Accept customization** - Use props/classes for variations, not duplication
- **Stay focused** - Single responsibility; compose for complex needs

When a component needs special treatment, extend the foundation—don't rebuild it.

## Barrel Files (index.ts re-exports)

Barrel files are an API design tool, not a file organization pattern. Use them when you need to expose a curated set of exports that other parts of your application consume as a unit (like a component library's public components, a feature's external interface, or a utility package's functions), but avoid them for internal implementation details or as a reflex in every directory - indiscriminate use obscures file locations, slows HMR, and creates maintenance overhead that outweighs any refactoring convenience.

## Testing Philosophy

**NEVER write tests for coverage metrics or for the sake of having tests.** Every test MUST provide definable value.

### What to Test

- **Your logic** - Custom behavior, derived state, business rules
- **Your API contracts** - Props produce expected output
- **Edge cases** - Boundary conditions in YOUR code

### What NOT to Test

- **Platform behavior** - Buttons fire onClick, disabled prevents clicks, form submission works
- **Framework behavior** - React renders children, props spread, refs forward
- **Third-party libraries** - Their tests cover their code

### Example

```tsx
// GOOD: Tests our derived state logic
it("is disabled when loading", () => {
  render(<Button isLoading>Save</Button>);
  expect(screen.getByRole("button")).toBeDisabled();
});

// BAD: Tests browser behavior
it("does not fire click when disabled", async () => {
  // The browser already guarantees this
});

// BAD: Tests React behavior
it("passes onClick to button", () => {
  // React's spread operator already guarantees this
});
```

If you find yourself testing that native elements do what they're supposed to do, you're testing the platform, not your code.

### Playwright: Use ARIA Snapshots

**MUST use `toMatchAriaSnapshot()` for component/page structure tests.** This captures the full accessibility tree in a single assertion.

```typescript
// GOOD: Single snapshot captures entire accessible structure
test("has correct accessible structure", async ({ page }) => {
  // Use specific class selector if page has multiple <header> elements
  await expect(page.locator(".Header")).toMatchAriaSnapshot(`
    - banner:
      - link "Maker Bench":
        - /url: /
      - navigation "Primary":
        - link "Submit Tool"
  `);
});

// BAD: Multiple fragmented assertions
test("displays the logo", async ({ page }) => {
  await expect(page.getByRole("link", { name: /maker/ })).toBeVisible();
});
test("logo links to home", async ({ page }) => {
  await expect(page.getByRole("link", { name: /maker/ })).toHaveAttribute(
    "href",
    "/",
  );
});
// ...more repetitive tests
```

Benefits:

- Tests the full accessibility tree hierarchy
- Single assertion = less maintenance
- Diffs show exactly what changed
- Aligned with how screen readers perceive the page

### CRITICAL: Keep ARIA Snapshots in Sync

**When modifying component structure, ALWAYS update corresponding ARIA snapshot tests.**

ARIA snapshots reflect the actual DOM structure. Changes to components (adding wrappers, changing elements, restructuring) MUST be followed by test updates.

**Workflow:**

1. Modify component structure
2. Run e2e tests: `npx playwright test --project=chromium`
3. If ARIA snapshot fails, check the error context file for actual structure
4. Update test to match actual (correct) structure
5. Verify tests pass before committing

**Common mismatches:**

- Wrapper `<div>`s appear as `generic` in ARIA tree
- `LinkButton` (styled link) → `link`, not `button`
- Styled `<span>`s inside links → `generic` children

**Never ignore failing ARIA tests** - they indicate either a bug in the component or an outdated test expectation.

## React: You Might Not Need useEffect

**CRITICAL: Before reaching for `useEffect`, ALWAYS consult https://react.dev/learn/you-might-not-need-an-effect**

Effects are an escape hatch, not a default pattern. Modern React codebases use them sparingly.

### When You DON'T Need useEffect

| Scenario | Better Approach |
| -------- | --------------- |
| Transforming data for render | Calculate during render |
| Caching expensive calculations | `useMemo` |
| Resetting state when prop changes | Use a `key` prop or set state during render |
| Handling user events | Event handlers |
| Sharing logic between handlers | Extract to a function |

### When You DO Need useEffect

- **Synchronizing with external systems** - network requests, browser APIs, third-party widgets
- **Subscriptions** - WebSockets, event listeners, external stores
- **Setting up/tearing down** - timers, observers, connections

### Pattern: Data Fetching

If you must fetch in an Effect, handle race conditions:

```typescript
useEffect(() => {
  let ignore = false;
  fetchData().then((data) => {
    if (!ignore) {
      setData(data);
    }
  });
  return () => { ignore = true; };
}, [dependency]);
```

### The Litmus Test

Ask: "Am I synchronizing with something outside React?"

- **Yes** → Effect may be appropriate
- **No** → There's almost certainly a better pattern

## React 19: Leverage Modern Features

This project runs React 19. Use its strengths instead of older patterns.

### Prefer These React 19 Features

| Feature | Use Case |
| ------- | -------- |
| `use()` hook | Reading promises/context in render |
| Actions (`useActionState`) | Form submissions with pending/error states |
| `useOptimistic` | Optimistic UI updates |
| `useFormStatus` | Form pending states without prop drilling |
| Server Components | Data fetching at component level (when applicable) |

### Form Handling Example

```tsx
// GOOD: React 19 Actions pattern
function SubmitForm() {
  const [state, submitAction, isPending] = useActionState(
    async (prev, formData) => {
      const result = await submitBookmark(formData);
      return result;
    },
    null
  );

  return (
    <form action={submitAction}>
      <button disabled={isPending}>Submit</button>
    </form>
  );
}

// LESS IDEAL: Manual state management
function SubmitForm() {
  const [isPending, setIsPending] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsPending(true);
    // ...
  };
}
```

### Avoid Legacy Patterns

- Don't use `forwardRef` - refs are now regular props
- Don't use `useContext` for simple reads - `use(Context)` works in conditionals
- Don't manually manage form state when Actions fit the use case

## Variable Naming: No Single-Letter Names

**Avoid single-letter variable names.** They hurt readability and make code harder to search.

### Always Use Descriptive Names

```typescript
// BAD: Single-letter variables
bookmarks.map((b) => ({
  id: b.id,
  tags: b.tags.map((t) => t.name),
}));

// GOOD: Descriptive names
bookmarks.map((bookmark) => ({
  id: bookmark.id,
  tags: bookmark.tags.map((tag) => tag.name),
}));
```

### Exception: Sort Comparators

`a` and `b` are acceptable in sort callbacks—they're conventional and the scope is tiny:

```typescript
// OK: Conventional sort comparator
tags.sort((a, b) => a.label.localeCompare(b.label));
```

### Why This Matters

- **Searchability** - "bookmark" is searchable; "b" matches everything
- **Readability** - `tag.name` instantly communicates intent; `t.name` requires mental mapping
- **Maintenance** - Future readers (including you) will thank you

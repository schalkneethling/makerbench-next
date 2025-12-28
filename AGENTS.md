# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
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

Use 'bd' for task tracking

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

## TypeScript Type Declarations

**CRITICAL: NEVER create custom `.d.ts` files without first checking for official types.**

### Before Creating Type Declarations

1. **Check if package ships types** - Look for `types` or `typings` in `package.json`
2. **Check for `@types/*` package** - Run `npm info @types/<package-name>`
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

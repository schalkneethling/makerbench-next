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

| Service | Purpose | Doc Reference |
|---------|---------|---------------|
| Browserless | Screenshot capture | https://docs.browserless.io/rest-apis/screenshot-api |
| Cloudinary | Image storage/delivery | https://cloudinary.com/documentation |
| Turso | SQLite database | https://docs.turso.tech |

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
  env: { get: (key: string) => string | undefined; };
};
```

### Only Create Custom Types When

- No official types exist after thorough search
- You've verified with documentation and npm registry
- Document WHY custom types were necessary in the file

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

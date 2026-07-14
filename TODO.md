# Query Contracts and Observability

Deliver issues [#57](https://github.com/schalkneethling/makerbench-next/issues/57),
[#76](https://github.com/schalkneethling/makerbench-next/issues/76),
[#106](https://github.com/schalkneethling/makerbench-next/issues/106), and
[#107](https://github.com/schalkneethling/makerbench-next/issues/107) as one
cohesive PR.

## Outcome

- Tool and resource list/search endpoints share strict pagination parsing.
- Tool list/search responses return accurate totals without breaking load-more behavior.
- API performance telemetry is intentional, consistent, structured, and low-noise.
- AND/OR tool-search behavior has an explicit product decision; if implemented,
  the API, URL state, UI, and tests agree on the contract.

## Before editing

- [ ] Verify every issue against the current code and record obsolete or already-delivered scope.
- [ ] Inventory pagination parsing, count queries, response schemas, URL parameters,
      and `[perf]` logging across tool and resource endpoints and clients.
- [ ] Search for existing utilities before adding helpers; consolidate repeated logic
      behind typed, well-tested utilities.
- [ ] Confirm current endpoint defaults and maximum limits so consolidation does not
      change behavior accidentally.

## Shared pagination contract — #76

- [ ] Add or reuse one server-side pagination utility.
- [ ] Require strict decimal strings: positive `limit`, non-negative `offset`, and
      no trailing characters such as `20abc`.
- [ ] Preserve endpoint-specific defaults and maximum limits through explicit configuration.
- [ ] Apply the utility to tool list/search/tags and resource list/search endpoints.
- [ ] Add utility boundary tests and focused endpoint tests for valid, missing,
      capped, malformed, negative, and trailing-garbage values.

## Accurate tool totals — #106

- [ ] Add approved-tool count queries to tool list and search endpoints.
- [ ] Ensure search totals use the same title/tag predicates as the result query.
- [ ] Return numeric `pagination.total` while preserving `limit`, `offset`, and `hasMore`.
- [ ] Update shared/client Valibot schemas and types only where required.
- [ ] Verify `ResultCount` renders “Showing X of Y tools”.
- [ ] Cover empty, filtered, paginated, and load-more cases.

## Search-mode decision — #107

- [ ] Review current AND-only behavior and decide whether an AND/OR control materially
      improves the product without making search harder to understand.
- [ ] If deferred, document AND-only behavior and close #107 with the rationale.
- [ ] If implemented, define a non-conflicting query parameter contract, default to
      AND, synchronize it with URL state, and show the control only when both title
      and tag filters are active.
- [ ] If implemented, use the same predicate builder for result and total-count queries
      and test both modes at API and UI boundaries.

## Performance observability — #57

- [ ] Review server `[perf]` logs with the final count-query and pagination behavior.
- [ ] Remove migration-only and duplicate client/hook timing logs.
- [ ] Keep only measurements that support production diagnosis.
- [ ] Give retained events consistent names and fields without logging sensitive data.
- [ ] Prefer one shared timing/logging utility when multiple endpoints retain the same behavior.
- [ ] Add tests only for project-owned formatting/redaction logic, not `console` itself.

## Documentation and validation

- [ ] Update API/architecture documentation for totals, strict pagination, retained
      telemetry, and the search-mode decision.
- [ ] Run `pnpm test` and record any unrelated baseline failures separately.
- [ ] Run `pnpm lint`, `pnpm lint:css`, `pnpm typecheck`, formatting checks, and
      `git diff --check`.
- [ ] Run the production build with safe placeholder environment values when local
      Varlock/1Password values are unavailable.
- [ ] Update Playwright ARIA snapshots only if the search controls or page structure change.
- [ ] Confirm no Vitest, Playwright, Node, or development-server processes remain.

## Out of scope

- Changing resource-card layout or visual design.
- Broad API-client or React-hook modernization tracked by #60 and #75.
- Search-provider migration or Algolia integration.
- Unrelated cleanup discovered while touching the endpoints; create focused follow-up issues.

# RLS Parity: LinkStack to MakerBench

## Scope

This comparison covers the signed-in personal library and current moderation
queue. It compares LinkStack's `supabase/schema.sql` and dated migrations with
MakerBench's Drizzle schema and `migrations/postgres/` history.

MakerBench routes authenticate in Netlify Functions and use a trusted server
Postgres connection. RLS is the separate database boundary for direct Supabase
access and future authenticated callers.

## Policy Matrix

| Concern                        | State before `0007`                                                                                                                                                                                                                  | Decision in `0007`                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resource RLS tracking          | `resources` was RLS-enabled in SQL but not represented in the Drizzle snapshot.                                                                                                                                                      | Track RLS in the schema, generated migration, and snapshot.                                                                                                                                                                                                                                                                                                             |
| Resource SELECT                | `0000` and `0001` recreated `resources are public` with `USING (true)`. PostgreSQL ORs permissive policies, so that policy defeated the restricted SELECT policy from `0003`. The `0003` policy also omitted approved tool listings. | Drop both policy names and create one policy `TO anon, authenticated`. It exposes resources referenced by approved tool listings, public listings, stacks, or stack items whose parent stack is also approved, plus resources bookmarked by `auth.uid()`. No orphan-resource, admin, or unconditional predicate remains. Moderation uses the trusted server connection. |
| Resource INSERT and grants     | LinkStack defined an authenticated insert policy, but MakerBench migration history did not preserve it or guarantee table grants. Supabase deployment defaults are not treated as migration history.                                 | Create the insert policy `TO authenticated` with a non-null `auth.uid()` check. Revoke existing anon/authenticated resource privileges, then grant only `SELECT` to both roles and `INSERT` to authenticated. No direct `UPDATE` or `DELETE` grant is retained for these roles. Service-role access is unchanged.                                                       |
| Bookmark ownership             | The owner-only bookmark policy in `0003` uses `auth.uid() = user_id`.                                                                                                                                                                | Already equivalent; resource visibility now uses the same ownership boundary.                                                                                                                                                                                                                                                                                           |
| Public moderation tables       | Owner/admin policies existed in `0003`, but RLS enablement was not represented consistently in MakerBench migrations or snapshots.                                                                                                   | Enable and track RLS for public listings, stacks, and stack items. Existing moderation policies remain unchanged.                                                                                                                                                                                                                                                       |
| Tool listings                  | MakerBench-specific table with approved public reads and service-role writes from `0000`; no LinkStack equivalent.                                                                                                                   | Track its existing RLS state and include only approved tool listings in resource visibility.                                                                                                                                                                                                                                                                            |
| Owner-only publication inserts | LinkStack has owner-constrained public listing, stack, and stack-item insert policies. MakerBench has no current signed-in publication route for these surfaces.                                                                     | Deferred to [#68](https://github.com/schalkneethling/makerbench-next/issues/68), where the publication workflow and its ownership contract can be implemented together. They are not broad-ported here.                                                                                                                                                                 |

## Functions And Triggers

| LinkStack object                                         | MakerBench decision                                                                                                                                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.is_admin(check_user_id uuid default auth.uid())` | Already covered by MakerBench's stricter `public.is_admin()` in `0003`. It always checks `auth.uid()`, preventing callers from probing another user's role; it remains `SECURITY DEFINER`, `STABLE`, and has a fixed `search_path`. |
| `update_updated_at_column()` and update triggers         | Not ported. The active library route inserts/reads bookmarks, while moderation writes `updated_at` explicitly. Existing MakerBench migrations retain the resource and tool-listing triggers required by current update paths.       |

## Verification

`netlify/functions/__tests__/rls-migration.test.ts` statically checks the
migration SQL: broad-policy removal, exact resource visibility predicates,
role targeting, grants, and existing moderation admin gates. It is a migration
contract test, not executable proof of PostgreSQL actor behavior.

## Proposed Follow-up Issue

**Title:** Add disposable PostgreSQL RLS actor integration tests

**Priority recommendation:** `p2`

**Body:**

> Add an isolated local Supabase/PostgreSQL test harness that applies the full
> MakerBench migration journal and executes access-boundary cases as `anon`,
> `authenticated`, and `service_role` actors. Seed approved and pending tool
> listings, public listings, stacks, stack items, and bookmarks owned by two
> users. Verify anonymous approved-catalog visibility, owner-only private
> resource visibility, denial for another user, authenticated resource insert,
> denied anon insert, and trusted moderation access. The harness must use a
> disposable database, run in CI without shared credentials, and fail when a
> permissive policy or excess grant reopens access.

Do not create this issue as part of #71.

## Other Deferred Work

- Empty-database bootstrap parity: the early MakerBench migration history
  assumes the original LinkStack tables already exist. Making fresh Supabase
  provisioning self-contained needs a separately reviewed baseline migration.

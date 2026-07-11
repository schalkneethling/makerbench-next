# RLS Parity: LinkStack to MakerBench

## Scope

This comparison covers the signed-in personal library and the current moderation
queue only. It compares LinkStack's `supabase/schema.sql` and dated migrations
with MakerBench's Drizzle schema and `migrations/postgres/` history.

MakerBench routes authenticate in Netlify Functions and use a trusted server
Postgres connection. RLS remains the database boundary for direct Supabase
access and future authenticated callers; this migration does not move those
server routes to an untrusted connection.

## Policy Matrix

| LinkStack concern                                                   | MakerBench state before 0007                                                                    | Decision                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS on `resources`                                                  | Enabled by 0000, but untracked in Drizzle                                                       | Track in schema and migration.                                                                                                                                                                                             |
| RLS on `bookmarks`                                                  | Enabled and owner `FOR ALL` policy present                                                      | Already equivalent.                                                                                                                                                                                                        |
| Authenticated resource insert                                       | Missing                                                                                         | Ported. The library create flow needs an authenticated actor to create a newly normalized shared resource.                                                                                                                 |
| Resource select/update/delete                                       | Existing policies include LinkStack behavior and account for public stacks/items                | Already equivalent or stricter.                                                                                                                                                                                            |
| RLS on `public_listings`, `public_stacks`, and `public_stack_items` | Owner/admin moderation policies existed, but RLS was not enabled by MakerBench migrations       | Enabled and tracked. Existing policies now take effect.                                                                                                                                                                    |
| Public listing, stack, and stack-item select/update/delete          | Present in 0003 with `public.is_admin()` and ownership checks                                   | Already equivalent for moderation.                                                                                                                                                                                         |
| LinkStack owner-only listing/stack/item insert policies             | Not present                                                                                     | Intentionally excluded. Current public submission routes allow anonymous, server-side submissions, and there is no signed-in stack publication route. Porting these policies would incorrectly redefine that API contract. |
| `user_roles` and `user_preferences` policies                        | Enabled and present                                                                             | Already equivalent.                                                                                                                                                                                                        |
| `tool_listings` RLS                                                 | Enabled by 0000 with public-approved reads and trusted service writes, but untracked in Drizzle | Track RLS only. It is part of the moderation queue but has no LinkStack equivalent.                                                                                                                                        |

## Functions And Triggers

| LinkStack object                                         | MakerBench decision                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.is_admin(check_user_id uuid default auth.uid())` | Already covered by MakerBench's stricter `public.is_admin()` in 0003. It always checks `auth.uid()`, preventing callers from probing another user's role; it remains `SECURITY DEFINER`, `STABLE`, and has a fixed `search_path`.                                                                                                                           |
| `update_updated_at_column()` and update triggers         | Not ported. The active library route inserts/reads bookmarks, while moderation writes `updated_at` explicitly. Existing MakerBench migrations already retain the resource and tool-listing triggers required by their update paths. Adding the remaining historical LinkStack triggers would broaden this issue without current behavior depending on them. |

## Verification

`netlify/functions/__tests__/rls-migration.test.ts` is a migration smoke test
for the enabled-table set, the authenticated resource-insert boundary, and the
admin gate in existing direct moderation policies. The repository has no
disposable Postgres/Supabase test database or role-switching harness, so it
does not execute these policies against a shared database.

## Deliberately Deferred

- Empty-database bootstrap parity: the early MakerBench migration history
  assumes the original LinkStack tables already exist. Making fresh Supabase
  provisioning self-contained needs a separately reviewed baseline migration.
- Executable RLS actor tests: add a disposable Postgres/Supabase harness that
  can exercise anonymous, owner, other-user, and admin roles after migration.

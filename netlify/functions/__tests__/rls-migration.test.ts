import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const rlsMigration = readFileSync(
  new URL(
    "../../../migrations/postgres/0007_kind_sentinel.sql",
    import.meta.url,
  ),
  "utf8",
);
const existingPolicies = readFileSync(
  new URL(
    "../../../migrations/postgres/0003_auth_library_policies.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Extracts a single policy statement from the established policy migration. */
function policySql(name: string): string {
  const start = existingPolicies.indexOf(`CREATE POLICY "${name}"`);
  const end = existingPolicies.indexOf("--> statement-breakpoint", start);

  return existingPolicies.slice(start, end === -1 ? undefined : end);
}

describe("RLS migration boundaries", () => {
  it("enables RLS for the resources and moderation tables used by current routes", () => {
    for (const table of [
      "resources",
      "tool_listings",
      "public_listings",
      "public_stacks",
      "public_stack_items",
    ]) {
      expect(rlsMigration).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
      );
    }
  });

  it("requires an authenticated database actor before creating a shared resource", () => {
    expect(rlsMigration).toMatch(
      /CREATE POLICY "authenticated users can create resources"[\s\S]*FOR INSERT[\s\S]*WITH CHECK \(auth\.uid\(\) IS NOT NULL\);/,
    );
  });

  it("keeps every direct moderation read or mutation policy gated by ownership or admin role", () => {
    for (const policy of [
      "approved public listings are public",
      "owners and admins can delete public listings",
      "owners and admins can update public listings",
      "approved public stacks are public",
      "owners and admins can delete public stacks",
      "owners and admins can update public stacks",
      "approved public stack items are public",
      "owners and admins can delete public stack items",
      "owners and admins can update public stack items",
    ]) {
      expect(policySql(policy)).toContain("public.is_admin()");
    }
  });
});

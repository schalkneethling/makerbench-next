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

/** Extracts one statement from a Drizzle SQL migration. */
function migrationStatement(sql: string, statementStart: string): string {
  const start = sql.indexOf(statementStart);
  const end = sql.indexOf("--> statement-breakpoint", start);

  expect(start).toBeGreaterThanOrEqual(0);
  return sql.slice(start, end === -1 ? undefined : end);
}

describe("RLS migration SQL contract", () => {
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

  it("drops the broad resource policy and declares exact catalog and owner visibility", () => {
    expect(rlsMigration).toContain(
      'DROP POLICY IF EXISTS "resources are public"\n  ON public.resources;',
    );
    expect(rlsMigration).not.toContain('CREATE POLICY "resources are public"');

    const selectPolicy = migrationStatement(
      rlsMigration,
      'CREATE POLICY "resource owners and public catalog can read resources"',
    );

    expect(selectPolicy).toContain("FOR SELECT\n  TO anon, authenticated");
    expect(selectPolicy).toMatch(
      /FROM public\.tool_listings[\s\S]*tool_listings\.resource_id = resources\.id[\s\S]*tool_listings\.status = 'approved'/,
    );
    expect(selectPolicy).toMatch(
      /FROM public\.public_listings[\s\S]*public_listings\.resource_id = resources\.id[\s\S]*public_listings\.status = 'approved'/,
    );
    expect(selectPolicy).toMatch(
      /FROM public\.public_stacks[\s\S]*public_stacks\.resource_id = resources\.id[\s\S]*public_stacks\.status = 'approved'/,
    );
    expect(selectPolicy).toMatch(
      /FROM public\.public_stack_items[\s\S]*public_stack_items\.resource_id = resources\.id[\s\S]*public_stack_items\.status = 'approved'/,
    );
    expect(selectPolicy).toMatch(
      /FROM public\.bookmarks[\s\S]*bookmarks\.resource_id = resources\.id[\s\S]*bookmarks\.user_id = auth\.uid\(\)/,
    );
    expect(selectPolicy.match(/\bEXISTS \(/g)).toHaveLength(5);
    expect(selectPolicy.match(/\bOR EXISTS \(/g)).toHaveLength(4);
    expect(selectPolicy).not.toContain("public.is_admin()");
    expect(selectPolicy).not.toContain("NOT EXISTS");
    expect(selectPolicy).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(selectPolicy).not.toMatch(/\bOR\s+true\b/i);
  });

  it("targets authenticated resource inserts and grants only required table privileges", () => {
    const insertPolicy = migrationStatement(
      rlsMigration,
      'CREATE POLICY "authenticated users can create resources"',
    );

    expect(insertPolicy).toContain("FOR INSERT\n  TO authenticated");
    expect(insertPolicy).toContain("WITH CHECK (auth.uid() IS NOT NULL)");
    expect(insertPolicy).not.toContain("TO anon");
    expect(rlsMigration).toContain(
      "REVOKE ALL PRIVILEGES ON TABLE public.resources\n  FROM anon, authenticated;",
    );
    expect(rlsMigration).toContain(
      "GRANT SELECT ON TABLE public.resources\n  TO anon, authenticated;",
    );
    expect(rlsMigration).toContain(
      "GRANT INSERT ON TABLE public.resources\n  TO authenticated;",
    );
    expect(rlsMigration).not.toMatch(
      /GRANT (?:UPDATE|DELETE|ALL PRIVILEGES) ON TABLE public\.resources\s+TO (?:anon|authenticated)/i,
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
      expect(
        migrationStatement(existingPolicies, `CREATE POLICY "${policy}"`),
      ).toContain("public.is_admin()");
    }
  });
});

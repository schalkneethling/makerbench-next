import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

import {
  findSubmissionBlocklistMatch,
  normalizeBlocklistValue,
  recordSubmissionBlocklistEvent,
  submissionMatchesBlocklistRule,
} from "../submission-blocklist";
import { getDb } from "../db";
import { getPgQuery } from "../../__tests__/test-utils";

beforeEach(() => vi.clearAllMocks());

describe("submission blocklist normalization", () => {
  it("normalizes exact URLs consistently", () => {
    expect(
      normalizeBlocklistValue(
        "url",
        "HTTPS://Example.COM:443/path/?b=2&a=1#fragment",
      ),
    ).toBe("https://example.com/path?a=1&b=2");
  });

  it("normalizes common domain variants", () => {
    expect(normalizeBlocklistValue("domain", "WWW.Example.COM.")).toBe(
      "example.com",
    );
    expect(normalizeBlocklistValue("domain", "https://www.example.com")).toBe(
      "example.com",
    );
  });

  it("rejects domain rules with URL-specific parts", () => {
    expect(normalizeBlocklistValue("domain", "example.com/path")).toBeNull();
    expect(normalizeBlocklistValue("domain", "example.com?probe=1")).toBeNull();
  });
});

describe("submission blocklist matching", () => {
  it("finds underscore-containing domain rules using a literal LIKE suffix", async () => {
    const rule = {
      id: "11111111-1111-4111-8111-111111111111",
      matchType: "domain" as const,
      normalizedValue: "under_score.example.com",
    };
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([rule]),
    };
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      findSubmissionBlocklistMatch(
        "https://docs.under_score.example.com/resource",
      ),
    ).resolves.toEqual(rule);

    const query = getPgQuery(mockDb.where.mock.calls[0][0]);
    expect(query.sql).toContain("replace(");
    expect(query.sql).toContain("escape chr(92)");
  });

  it("returns null when the database query has no matching rule", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      findSubmissionBlocklistMatch("https://allowed.example.com"),
    ).resolves.toBeNull();
  });

  it("matches exact URLs after normalization but preserves meaningful queries", () => {
    const rule = {
      matchType: "url" as const,
      normalizedValue: "https://example.com/path?a=1&b=2",
    };

    expect(
      submissionMatchesBlocklistRule(
        "https://EXAMPLE.com/path/?b=2&a=1#ignored",
        rule,
      ),
    ).toBe(true);
    expect(
      submissionMatchesBlocklistRule("https://example.com/path?a=2&b=2", rule),
    ).toBe(false);
  });

  it("matches a domain, www variant, and subdomains without suffix collisions", () => {
    const rule = {
      matchType: "domain" as const,
      normalizedValue: "example.com",
    };

    expect(
      submissionMatchesBlocklistRule("https://www.example.com", rule),
    ).toBe(true);
    expect(
      submissionMatchesBlocklistRule("https://docs.example.com/path", rule),
    ).toBe(true);
    expect(submissionMatchesBlocklistRule("https://notexample.com", rule)).toBe(
      false,
    );
  });

  it("redacts credentials, queries, and fragments from audit URLs", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const mockDb = { insert: vi.fn(() => ({ values })) };
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    await recordSubmissionBlocklistEvent(
      {
        id: "11111111-1111-4111-8111-111111111111",
        matchType: "domain",
        normalizedValue: "example.com",
      },
      "https://user:secret@example.com/blocked?token=sensitive#fragment",
      null,
    );

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedUrl: "https://example.com/blocked" }),
    );
  });
});

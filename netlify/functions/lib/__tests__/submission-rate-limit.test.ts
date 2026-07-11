import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

import type { AuthenticatedUser } from "../auth";
import { getDb } from "../db";
import { InvalidEnvironmentError } from "../env";
import {
  consumeSubmissionRateLimit,
  createSubmissionRateLimitKey,
  getSubmissionRateLimitConfig,
  type SubmissionRateLimitConfig,
} from "../submission-rate-limit";
import { getPgQuery } from "../../__tests__/test-utils";

const config: SubmissionRateLimitConfig = {
  secret: "test-submission-rate-limit-secret-1234567890",
  maxAttempts: 5,
  windowSeconds: 3600,
};

const rateLimitMigration = readFileSync(
  new URL(
    "../../../../migrations/postgres/0008_flat_proteus.sql",
    import.meta.url,
  ),
  "utf8",
);

function setRateLimitEnvironment(
  values: Partial<Record<string, string>>,
): () => void {
  const originalGet = Netlify.env.get;
  Netlify.env.get = vi.fn((key: string) => values[key]);
  return () => {
    Netlify.env.get = originalGet;
  };
}

describe("submission rate limit", () => {
  it("allows the first and boundary attempts, then rejects an over-limit attempt", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ attempt_count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ attempt_count: 5 }] })
      .mockResolvedValueOnce({ rows: [] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    await expect(consumeSubmissionRateLimit("first", config)).resolves.toBe(
      true,
    );
    await expect(consumeSubmissionRateLimit("boundary", config)).resolves.toBe(
      true,
    );
    await expect(consumeSubmissionRateLimit("rejected", config)).resolves.toBe(
      false,
    );
  });

  it("uses separate HMAC keys for verified users and anonymous Netlify client IPs", () => {
    const authenticated = {
      user: { id: "11111111-1111-4111-8111-111111111111" },
      isAdmin: false,
    } as AuthenticatedUser;
    const authenticatedKey = createSubmissionRateLimitKey(
      { authenticated, clientIp: "203.0.113.1" },
      config.secret,
    );
    const anonymousKey = createSubmissionRateLimitKey(
      { authenticated: null, clientIp: "203.0.113.1" },
      config.secret,
    );

    expect(authenticatedKey).toMatch(/^[a-f0-9]{64}$/);
    expect(anonymousKey).toMatch(/^[a-f0-9]{64}$/);
    expect(authenticatedKey).not.toBe(anonymousKey);
    expect(anonymousKey).not.toContain("203.0.113.1");
    expect(authenticatedKey).not.toContain(authenticated.user.id);
  });

  it("fails closed when anonymous Netlify context has no client IP", () => {
    expect(() =>
      createSubmissionRateLimitKey(
        { authenticated: null, clientIp: undefined },
        config.secret,
      ),
    ).toThrow(InvalidEnvironmentError);
  });

  it("rejects missing or invalid rate-limit configuration with Valibot", () => {
    const restoreMissing = setRateLimitEnvironment({
      SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS: "5",
      SUBMISSION_RATE_LIMIT_WINDOW_SECONDS: "3600",
    });
    try {
      expect(getSubmissionRateLimitConfig).toThrow(InvalidEnvironmentError);
    } finally {
      restoreMissing();
    }

    const restoreInvalid = setRateLimitEnvironment({
      SUBMISSION_RATE_LIMIT_SECRET: config.secret,
      SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS: "not-a-number",
      SUBMISSION_RATE_LIMIT_WINDOW_SECONDS: "3600",
    });
    try {
      expect(getSubmissionRateLimitConfig).toThrow(InvalidEnvironmentError);
    } finally {
      restoreInvalid();
    }
  });

  it("uses one atomic Postgres upsert that admits no concurrent over-limit update", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ attempt_count: 1 }] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    await consumeSubmissionRateLimit("hmac-key", config);

    const query = getPgQuery(execute.mock.calls[0]?.[0]);
    expect(query.sql).toContain('INSERT INTO "public_submission_rate_limits"');
    expect(query.sql).toContain(
      'ON CONFLICT ("public_submission_rate_limits"."key_hash") DO UPDATE',
    );
    expect(query.sql).toContain(
      '"public_submission_rate_limits"."attempt_count" < $',
    );
    expect(query.sql).toContain("make_interval(secs => $");
    expect(query.sql).toContain(
      'RETURNING "public_submission_rate_limits"."attempt_count"',
    );
    expect(query.sql).not.toContain("SELECT");
    expect(query.params).toContain("hmac-key");
    expect(query.params).toContain(config.maxAttempts);
    expect(query.params).toContain(config.windowSeconds);
  });

  it("keeps the rate-limit state inaccessible to browser database roles", () => {
    expect(rateLimitMigration).toContain(
      'ALTER TABLE "public_submission_rate_limits" ENABLE ROW LEVEL SECURITY;',
    );
    expect(rateLimitMigration).toContain(
      "REVOKE ALL PRIVILEGES ON TABLE public.public_submission_rate_limits\n  FROM anon, authenticated;",
    );
  });
});

import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  SUBMISSION_RATE_LIMIT_CLEANUP_BATCH_SIZE,
  SUBMISSION_RATE_LIMIT_RETENTION_SECONDS,
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
const retentionIndexMigration = readFileSync(
  new URL(
    "../../../../migrations/postgres/0009_rich_supernaut.sql",
    import.meta.url,
  ),
  "utf8",
);
const environmentSchema = readFileSync(
  new URL("../../../../.env.schema", import.meta.url),
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

function createPgliteExecutor(database: PGlite) {
  let pending = Promise.resolve();

  return {
    execute: (query: unknown) => {
      const rendered = getPgQuery(query);
      const operation = pending.then(async () => {
        const result = await database.query(rendered.sql, rendered.params);
        return { rows: result.rows };
      });
      pending = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
  };
}

describe("submission rate limit", () => {
  it("allows the first and boundary attempts, then rejects an over-limit attempt", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_count: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_count: 5 }] })
      .mockResolvedValueOnce({ rows: [] })
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

  it("declares the HMAC secret as required sensitive external Varlock config", () => {
    expect(environmentSchema).toContain(
      "# @type=string(minLength=32) @sensitive @required\nSUBMISSION_RATE_LIMIT_SECRET=",
    );
  });

  it("keeps bounded cleanup separate from the atomic admission statement", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_count: 1 }] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    await consumeSubmissionRateLimit("hmac-key", config);

    const cleanupQuery = getPgQuery(execute.mock.calls[0]?.[0]);
    expect(cleanupQuery.sql).toContain("WITH stale_rows AS");
    expect(cleanupQuery.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(cleanupQuery.sql).toMatch(
      /"public_submission_rate_limits"\."window_started_at"\s+<=/,
    );
    expect(cleanupQuery.params).toContain(
      SUBMISSION_RATE_LIMIT_RETENTION_SECONDS,
    );
    expect(cleanupQuery.params).toContain(
      SUBMISSION_RATE_LIMIT_CLEANUP_BATCH_SIZE,
    );

    const admissionQuery = getPgQuery(execute.mock.calls[1]?.[0]);
    expect(admissionQuery.sql).toContain(
      'INSERT INTO "public_submission_rate_limits"',
    );
    expect(admissionQuery.sql).toContain('ON CONFLICT ("key_hash") DO UPDATE');
    expect(admissionQuery.sql).toContain(
      '"public_submission_rate_limits"."attempt_count" < $',
    );
    expect(admissionQuery.sql).toContain("make_interval(secs => $");
    expect(admissionQuery.sql).toContain(
      'RETURNING "public_submission_rate_limits"."attempt_count"',
    );
    expect(admissionQuery.sql).not.toContain("SELECT");
    expect(admissionQuery.params).toContain("hmac-key");
    expect(admissionQuery.params).toContain(config.maxAttempts);
    expect(admissionQuery.params).toContain(config.windowSeconds);
  });

  it("keeps the rate-limit state inaccessible to browser database roles", () => {
    expect(rateLimitMigration).toContain(
      'ALTER TABLE "public_submission_rate_limits" ENABLE ROW LEVEL SECURITY;',
    );
    expect(rateLimitMigration).toContain(
      "REVOKE ALL PRIVILEGES ON TABLE public.public_submission_rate_limits\n  FROM anon, authenticated;",
    );
    expect(retentionIndexMigration).toContain(
      'CREATE INDEX "idx_public_submission_rate_limits_updated_at" ON "public_submission_rate_limits" USING btree ("updated_at");',
    );
  });
});

describe.sequential("submission rate limit PostgreSQL execution", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE public_submission_rate_limits (
        key_hash text PRIMARY KEY NOT NULL,
        window_started_at timestamp with time zone DEFAULT now() NOT NULL,
        attempt_count integer DEFAULT 1 NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT public_submission_rate_limits_attempt_count_check
          CHECK (attempt_count > 0)
      );
      CREATE INDEX idx_public_submission_rate_limits_updated_at
        ON public_submission_rate_limits (updated_at);
    `);
    vi.mocked(getDb).mockReturnValue(createPgliteExecutor(database) as never);
  });

  afterEach(async () => {
    await database.close();
  });

  it("admits exactly max requests in a serialized burst and resets an expired window to one", async () => {
    const attemptCount = config.maxAttempts + 7;
    const admissions = await Promise.all(
      Array.from({ length: attemptCount }, () =>
        consumeSubmissionRateLimit("concurrent-key", config),
      ),
    );

    expect(admissions.filter(Boolean)).toHaveLength(config.maxAttempts);
    await expect(
      database.query<{ attempt_count: number }>(
        "SELECT attempt_count FROM public_submission_rate_limits WHERE key_hash = $1",
        ["concurrent-key"],
      ),
    ).resolves.toMatchObject({ rows: [{ attempt_count: config.maxAttempts }] });

    await database.query(
      `UPDATE public_submission_rate_limits
       SET window_started_at = now() - interval '2 hours', updated_at = now()
       WHERE key_hash = $1`,
      ["concurrent-key"],
    );

    await expect(
      consumeSubmissionRateLimit("concurrent-key", config),
    ).resolves.toBe(true);
    await expect(
      database.query<{ attempt_count: number }>(
        "SELECT attempt_count FROM public_submission_rate_limits WHERE key_hash = $1",
        ["concurrent-key"],
      ),
    ).resolves.toMatchObject({ rows: [{ attempt_count: 1 }] });
  });

  it("deletes at most one batch of retained expired rows and preserves active windows", async () => {
    const staleCount = SUBMISSION_RATE_LIMIT_CLEANUP_BATCH_SIZE + 5;
    await database.query(
      `INSERT INTO public_submission_rate_limits
         (key_hash, window_started_at, attempt_count, updated_at)
       SELECT
         'stale-' || value,
         now() - interval '31 days',
         1,
         now() - interval '31 days'
       FROM generate_series(1, $1) AS value`,
      [staleCount],
    );
    await database.query(
      `INSERT INTO public_submission_rate_limits
         (key_hash, window_started_at, attempt_count, updated_at)
       VALUES ('active-key', now(), 1, now() - interval '31 days')`,
    );

    await consumeSubmissionRateLimit("cleanup-trigger", config);

    await expect(
      database.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM public_submission_rate_limits WHERE key_hash LIKE 'stale-%'",
      ),
    ).resolves.toMatchObject({ rows: [{ count: 5 }] });
    await expect(
      database.query<{ key_hash: string }>(
        "SELECT key_hash FROM public_submission_rate_limits WHERE key_hash = 'active-key'",
      ),
    ).resolves.toMatchObject({ rows: [{ key_hash: "active-key" }] });
  });
});

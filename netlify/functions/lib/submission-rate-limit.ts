import { createHmac } from "node:crypto";

import { sql } from "drizzle-orm";
import * as v from "valibot";

import { publicSubmissionRateLimitsTable } from "../../../src/db/schema";
import type { AuthenticatedUser } from "./auth";
import { getDb } from "./db";
import { getEnv, InvalidEnvironmentError } from "./env";

const SUBMISSION_RATE_LIMIT_ENV_KEYS = [
  "SUBMISSION_RATE_LIMIT_SECRET",
  "SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS",
  "SUBMISSION_RATE_LIMIT_WINDOW_SECONDS",
] as const;

const positiveIntegerStringSchema = v.pipe(
  v.string(),
  v.regex(/^[1-9][0-9]*$/, "Must be a positive integer"),
  v.transform(Number),
  v.integer(),
  v.minValue(1),
);

/** Validates the server-only controls that tune public submission throttling. */
export const submissionRateLimitEnvironmentSchema = v.object({
  SUBMISSION_RATE_LIMIT_SECRET: v.pipe(
    v.string(),
    v.minLength(32, "Must contain at least 32 characters"),
  ),
  SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS: v.pipe(
    positiveIntegerStringSchema,
    v.maxValue(1000),
  ),
  SUBMISSION_RATE_LIMIT_WINDOW_SECONDS: v.pipe(
    positiveIntegerStringSchema,
    v.maxValue(86_400),
  ),
});

export interface SubmissionRateLimitConfig {
  secret: string;
  maxAttempts: number;
  windowSeconds: number;
}

interface SubmissionRateLimitIdentity {
  authenticated: AuthenticatedUser | null;
  clientIp: string | undefined;
}

/** Reads and validates the server-only rate-limit configuration. */
export function getSubmissionRateLimitConfig(): SubmissionRateLimitConfig {
  const environment = Object.fromEntries(
    SUBMISSION_RATE_LIMIT_ENV_KEYS.map((key) => [key, getEnv(key)]),
  );
  const validation = v.safeParse(
    submissionRateLimitEnvironmentSchema,
    environment,
  );

  if (!validation.success) {
    const invalidKeys = [
      ...new Set(
        validation.issues
          .map((issue) => issue.path?.[0]?.key)
          .filter((key): key is string => typeof key === "string"),
      ),
    ];
    throw new InvalidEnvironmentError(invalidKeys);
  }

  return {
    secret: validation.output.SUBMISSION_RATE_LIMIT_SECRET,
    maxAttempts: validation.output.SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS,
    windowSeconds: validation.output.SUBMISSION_RATE_LIMIT_WINDOW_SECONDS,
  };
}

/** Creates the non-reversible, server-only rate-limit key for a submitter. */
export function createSubmissionRateLimitKey(
  identity: SubmissionRateLimitIdentity,
  secret: string,
): string {
  const subject = identity.authenticated
    ? `user:${identity.authenticated.user.id}`
    : `ip:${identity.clientIp?.trim() ?? ""}`;

  if (!identity.authenticated && !identity.clientIp?.trim()) {
    throw new InvalidEnvironmentError(["NETLIFY_CONTEXT_IP"]);
  }

  return createHmac("sha256", secret).update(subject).digest("hex");
}

/** Atomically consumes one rate-limit slot and returns whether the request may proceed. */
export async function consumeSubmissionRateLimit(
  keyHash: string,
  config: SubmissionRateLimitConfig,
): Promise<boolean> {
  const result = await getDb().execute(sql`
    INSERT INTO ${publicSubmissionRateLimitsTable} (
      ${publicSubmissionRateLimitsTable.keyHash},
      ${publicSubmissionRateLimitsTable.windowStartedAt},
      ${publicSubmissionRateLimitsTable.attemptCount},
      ${publicSubmissionRateLimitsTable.updatedAt}
    )
    VALUES (${keyHash}, now(), 1, now())
    ON CONFLICT (${publicSubmissionRateLimitsTable.keyHash}) DO UPDATE
    SET
      ${publicSubmissionRateLimitsTable.windowStartedAt} = CASE
        WHEN ${publicSubmissionRateLimitsTable.windowStartedAt}
          <= now() - make_interval(secs => ${config.windowSeconds})
        THEN now()
        ELSE ${publicSubmissionRateLimitsTable.windowStartedAt}
      END,
      ${publicSubmissionRateLimitsTable.attemptCount} = CASE
        WHEN ${publicSubmissionRateLimitsTable.windowStartedAt}
          <= now() - make_interval(secs => ${config.windowSeconds})
        THEN 1
        ELSE ${publicSubmissionRateLimitsTable.attemptCount} + 1
      END,
      ${publicSubmissionRateLimitsTable.updatedAt} = now()
    WHERE
      ${publicSubmissionRateLimitsTable.windowStartedAt}
        <= now() - make_interval(secs => ${config.windowSeconds})
      OR ${publicSubmissionRateLimitsTable.attemptCount} < ${config.maxAttempts}
    RETURNING ${publicSubmissionRateLimitsTable.attemptCount}
  `);

  return result.rows.length > 0;
}

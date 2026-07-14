import { and, desc, eq, or, sql } from "drizzle-orm";
import * as v from "valibot";

import {
  publicSubmissionBlocklistEventsTable,
  publicSubmissionBlocklistTable,
} from "../../../src/db/schema";
import { getDb } from "./db";
import { normalizeUrl, parseAndNormalizeUrl } from "./url";

export const blocklistMatchTypeSchema = v.picklist(["url", "domain"]);
export const blocklistEntryRequestSchema = v.strictObject({
  matchType: blocklistMatchTypeSchema,
  value: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "A URL or domain is required"),
    v.maxLength(2000, "The value must be 2000 characters or less"),
  ),
});
export const blocklistDeleteRequestSchema = v.strictObject({
  id: v.pipe(v.string(), v.uuid()),
});

export type BlocklistMatchType = v.InferOutput<typeof blocklistMatchTypeSchema>;

export interface BlocklistMatch {
  id: string;
  matchType: BlocklistMatchType;
  normalizedValue: string;
}

function normalizeDomain(value: string): string | null {
  const candidate = value.includes("://") ? value : `https://${value}`;

  try {
    const url = new URL(candidate);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return (
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "")
        .replace(/\.$/, "") || null
    );
  } catch {
    return null;
  }
}

/** Normalizes an admin-supplied blocklist value for stable matching. */
export function normalizeBlocklistValue(
  matchType: BlocklistMatchType,
  value: string,
): string | null {
  if (matchType === "domain") {
    return normalizeDomain(value.trim());
  }

  return parseAndNormalizeUrl(value.trim());
}

function getNormalizedSubmissionDomain(normalizedUrl: string): string {
  return new URL(normalizedUrl).hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

/** Applies normalized exact-URL and parent-domain matching rules. */
export function submissionMatchesBlocklistRule(
  submittedUrl: string,
  rule: Pick<BlocklistMatch, "matchType" | "normalizedValue">,
): boolean {
  const normalizedUrl = normalizeUrl(submittedUrl);
  if (rule.matchType === "url") {
    return normalizedUrl === rule.normalizedValue;
  }

  const domain = getNormalizedSubmissionDomain(normalizedUrl);
  return (
    domain === rule.normalizedValue ||
    domain.endsWith(`.${rule.normalizedValue}`)
  );
}

/** Finds the first exact-URL or parent-domain rule matching a submission. */
export async function findSubmissionBlocklistMatch(
  submittedUrl: string,
): Promise<BlocklistMatch | null> {
  const normalizedUrl = normalizeUrl(submittedUrl);
  const normalizedDomain = getNormalizedSubmissionDomain(normalizedUrl);
  const [match] = await getDb()
    .select({
      id: publicSubmissionBlocklistTable.id,
      matchType: publicSubmissionBlocklistTable.matchType,
      normalizedValue: publicSubmissionBlocklistTable.normalizedValue,
    })
    .from(publicSubmissionBlocklistTable)
    .where(
      or(
        and(
          eq(publicSubmissionBlocklistTable.matchType, "url"),
          eq(publicSubmissionBlocklistTable.normalizedValue, normalizedUrl),
        ),
        and(
          eq(publicSubmissionBlocklistTable.matchType, "domain"),
          or(
            eq(
              publicSubmissionBlocklistTable.normalizedValue,
              normalizedDomain,
            ),
            sql`${normalizedDomain} like ('%.' || replace(${publicSubmissionBlocklistTable.normalizedValue}, '_', chr(92) || '_')) escape chr(92)`,
          ),
        ),
      ),
    )
    .limit(1);

  return match && submissionMatchesBlocklistRule(normalizedUrl, match)
    ? match
    : null;
}

/** Records a private audit event for a blocked submission attempt. */
export async function recordSubmissionBlocklistEvent(
  match: BlocklistMatch,
  normalizedUrl: string,
  submittedByUserId: string | null,
): Promise<void> {
  const auditUrl = new URL(normalizedUrl);
  auditUrl.username = "";
  auditUrl.password = "";
  auditUrl.search = "";
  auditUrl.hash = "";

  await getDb().insert(publicSubmissionBlocklistEventsTable).values({
    blocklistEntryId: match.id,
    normalizedUrl: auditUrl.toString(),
    matchedType: match.matchType,
    matchedValue: match.normalizedValue,
    submittedByUserId,
  });
}

/** Returns blocklist rules newest-first for the admin moderation surface. */
export async function listSubmissionBlocklistEntries() {
  return await getDb()
    .select({
      id: publicSubmissionBlocklistTable.id,
      matchType: publicSubmissionBlocklistTable.matchType,
      value: publicSubmissionBlocklistTable.value,
      normalizedValue: publicSubmissionBlocklistTable.normalizedValue,
      createdAt: publicSubmissionBlocklistTable.createdAt,
    })
    .from(publicSubmissionBlocklistTable)
    .orderBy(desc(publicSubmissionBlocklistTable.createdAt));
}

/** Returns recent redacted matches so admins can understand enforcement. */
export async function listSubmissionBlocklistEvents() {
  return await getDb()
    .select({
      id: publicSubmissionBlocklistEventsTable.id,
      normalizedUrl: publicSubmissionBlocklistEventsTable.normalizedUrl,
      matchedType: publicSubmissionBlocklistEventsTable.matchedType,
      matchedValue: publicSubmissionBlocklistEventsTable.matchedValue,
      createdAt: publicSubmissionBlocklistEventsTable.createdAt,
    })
    .from(publicSubmissionBlocklistEventsTable)
    .orderBy(desc(publicSubmissionBlocklistEventsTable.createdAt))
    .limit(50);
}

/** Creates a normalized blocklist rule, returning null for a duplicate. */
export async function createSubmissionBlocklistEntry(
  input: v.InferOutput<typeof blocklistEntryRequestSchema>,
  createdBy: string,
) {
  const normalizedValue = normalizeBlocklistValue(input.matchType, input.value);
  if (!normalizedValue) {
    return { outcome: "invalid" as const };
  }

  const [entry] = await getDb()
    .insert(publicSubmissionBlocklistTable)
    .values({
      matchType: input.matchType,
      value: input.value,
      normalizedValue,
      createdBy,
    })
    .onConflictDoNothing()
    .returning({
      id: publicSubmissionBlocklistTable.id,
      matchType: publicSubmissionBlocklistTable.matchType,
      value: publicSubmissionBlocklistTable.value,
      normalizedValue: publicSubmissionBlocklistTable.normalizedValue,
      createdAt: publicSubmissionBlocklistTable.createdAt,
    });

  return entry
    ? { outcome: "created" as const, entry }
    : { outcome: "duplicate" as const };
}

/** Deletes a blocklist rule without deleting its historical audit events. */
export async function deleteSubmissionBlocklistEntry(
  id: string,
): Promise<boolean> {
  const deleted = await getDb()
    .delete(publicSubmissionBlocklistTable)
    .where(eq(publicSubmissionBlocklistTable.id, id))
    .returning({ id: publicSubmissionBlocklistTable.id });

  return deleted.length > 0;
}

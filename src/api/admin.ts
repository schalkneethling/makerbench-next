import * as v from "valibot";

import { BookmarkApiError } from "./bookmarks";

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }

  return process.env.API_BASE_URL || "http://localhost:8888";
}

const moderationEntityTypeSchema = v.picklist([
  "tool",
  "resource",
  "stack",
  "stack-item",
]);
const moderationStatusSchema = v.picklist(["pending", "approved", "rejected"]);
const moderationTagSchema = v.object({
  id: v.string(),
  name: v.string(),
});
const moderationParentSchema = v.object({
  id: v.string(),
  title: v.string(),
});
const moderationItemSchema = v.object({
  id: v.string(),
  type: moderationEntityTypeSchema,
  url: v.string(),
  title: v.string(),
  description: v.nullable(v.string()),
  tags: v.array(moderationTagSchema),
  submitter: v.nullable(v.string()),
  submitterUrl: v.nullable(v.string()),
  parent: v.nullable(moderationParentSchema),
  createdAt: v.string(),
});
const moderationQueueResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    items: v.array(moderationItemSchema),
  }),
});
const moderationReviewResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    id: v.string(),
    type: moderationEntityTypeSchema,
    status: moderationStatusSchema,
  }),
});
const blocklistMatchTypeSchema = v.picklist(["url", "domain"]);
const blocklistEntrySchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  matchType: blocklistMatchTypeSchema,
  value: v.string(),
  normalizedValue: v.string(),
  createdAt: v.union([v.string(), v.date()]),
});
const blocklistEventSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  normalizedUrl: v.string(),
  matchedType: blocklistMatchTypeSchema,
  matchedValue: v.string(),
  createdAt: v.union([v.string(), v.date()]),
});
const blocklistEntriesResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    entries: v.array(blocklistEntrySchema),
    recentEvents: v.array(blocklistEventSchema),
  }),
});
const blocklistEntryResponseSchema = v.object({
  success: v.literal(true),
  data: blocklistEntrySchema,
});
const blocklistDeleteResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({ id: v.pipe(v.string(), v.uuid()) }),
});
const errorResponseSchema = v.object({
  success: v.literal(false),
  error: v.string(),
  details: v.optional(v.record(v.string(), v.array(v.string()))),
});

export type ModerationEntityType = v.InferOutput<
  typeof moderationEntityTypeSchema
>;
export type ModerationItem = v.InferOutput<typeof moderationItemSchema>;
export type ModerationReviewResult = v.InferOutput<
  typeof moderationReviewResponseSchema
>["data"];
export type BlocklistMatchType = v.InferOutput<typeof blocklistMatchTypeSchema>;
export type BlocklistEntry = v.InferOutput<typeof blocklistEntrySchema>;
export type BlocklistEvent = v.InferOutput<typeof blocklistEventSchema>;

export interface ReviewModerationItemData {
  type: ModerationEntityType;
  id: string;
  action: "approve" | "reject";
  rejectionCode?: string;
  rejectionReason?: string;
}

function throwApiError(json: unknown, status: number): never {
  const parsed = v.safeParse(errorResponseSchema, json);
  throw new BookmarkApiError(
    parsed.success ? parsed.output.error : "An unexpected error occurred",
    status,
    parsed.success ? parsed.output.details : undefined,
  );
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return { success: false, error: "Invalid response from server" };
  }
}

function getAuthHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function getModerationQueue(
  accessToken: string,
  type?: ModerationEntityType,
  signal?: AbortSignal,
): Promise<ModerationItem[]> {
  const searchParams = new URLSearchParams();
  if (type) {
    searchParams.set("type", type);
  }

  const response = await fetch(
    `${getBaseUrl()}/api/admin/moderation?${searchParams.toString()}`,
    {
      headers: getAuthHeaders(accessToken),
      signal,
    },
  );
  const json = await parseJsonResponse(response);

  if (!response.ok) {
    throwApiError(json, response.status);
  }

  const parsed = v.safeParse(moderationQueueResponseSchema, json);
  if (!parsed.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return parsed.output.data.items;
}

export async function reviewModerationItem(
  accessToken: string,
  data: ReviewModerationItemData,
): Promise<ModerationReviewResult> {
  const response = await fetch(`${getBaseUrl()}/api/admin/moderation`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const json = await parseJsonResponse(response);

  if (!response.ok) {
    throwApiError(json, response.status);
  }

  const parsed = v.safeParse(moderationReviewResponseSchema, json);
  if (!parsed.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return parsed.output.data;
}

/** Lists private submission blocklist rules for an authenticated admin. */
export async function getSubmissionBlocklist(
  accessToken: string,
  signal?: AbortSignal,
): Promise<{ entries: BlocklistEntry[]; recentEvents: BlocklistEvent[] }> {
  const response = await fetch(`${getBaseUrl()}/api/admin/blocklist`, {
    headers: getAuthHeaders(accessToken),
    signal,
  });
  const json = await parseJsonResponse(response);

  if (!response.ok) {
    throwApiError(json, response.status);
  }

  const parsed = v.safeParse(blocklistEntriesResponseSchema, json);
  if (!parsed.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return parsed.output.data;
}

/** Adds a normalized URL or domain rule to the submission blocklist. */
export async function createSubmissionBlocklistRule(
  accessToken: string,
  data: { matchType: BlocklistMatchType; value: string },
): Promise<BlocklistEntry> {
  const response = await fetch(`${getBaseUrl()}/api/admin/blocklist`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const json = await parseJsonResponse(response);

  if (!response.ok) {
    throwApiError(json, response.status);
  }

  const parsed = v.safeParse(blocklistEntryResponseSchema, json);
  if (!parsed.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return parsed.output.data;
}

/** Removes a rule while retaining its server-side audit history. */
export async function deleteSubmissionBlocklistRule(
  accessToken: string,
  id: string,
): Promise<void> {
  const response = await fetch(`${getBaseUrl()}/api/admin/blocklist`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  const json = await parseJsonResponse(response);

  if (!response.ok) {
    throwApiError(json, response.status);
  }

  const parsed = v.safeParse(blocklistDeleteResponseSchema, json);
  if (!parsed.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }
}

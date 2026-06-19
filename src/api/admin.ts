import * as v from "valibot";

import { BookmarkApiError } from "./bookmarks";

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
): Promise<ModerationItem[]> {
  const searchParams = new URLSearchParams();
  if (type) {
    searchParams.set("type", type);
  }

  const response = await fetch(
    `/api/admin/moderation?${searchParams.toString()}`,
    {
      headers: getAuthHeaders(accessToken),
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
  const response = await fetch("/api/admin/moderation", {
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

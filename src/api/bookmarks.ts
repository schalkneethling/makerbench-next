import * as v from "valibot";
import {
  apiErrorResponseSchema,
  type BookmarkRequest,
  type PublicSubmissionResponseData,
} from "../lib/validation";
import { PublicSubmissionApiError, submitPublicSubmission } from "./submissions";

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }

  return process.env.API_BASE_URL || "http://localhost:8888";
}

const bookmarkTagSchema = v.object({
  id: v.string(),
  name: v.string(),
});

const tagSchema = v.object({
  id: v.string(),
  name: v.string(),
  usageCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
});

const paginationSchema = v.object({
  total: v.optional(v.nullable(v.number())),
  limit: v.number(),
  offset: v.number(),
  hasMore: v.boolean(),
});

const bookmarkSchema = v.object({
  id: v.string(),
  url: v.string(),
  title: v.string(),
  description: v.nullable(v.string()),
  imageUrl: v.nullable(v.string()),
  submitterName: v.nullable(v.string()),
  submitterGithubUrl: v.nullable(v.string()),
  createdAt: v.string(),
  tags: v.array(bookmarkTagSchema),
});

const bookmarksDataSchema = v.object({
  bookmarks: v.array(bookmarkSchema),
  pagination: paginationSchema,
});

const tagsDataSchema = v.object({
  tags: v.array(tagSchema),
});

const bookmarksResponseSchema = v.object({
  success: v.literal(true),
  data: bookmarksDataSchema,
});

const tagsResponseSchema = v.object({
  success: v.literal(true),
  data: tagsDataSchema,
});

// TODO(#61): These bookmark* schemas are legacy compatibility exports for the
// tools API response envelope. Rename bookmarkSchema/Bookmark to Tool* once the
// client no longer needs the historical "bookmarks" response key.
export type BookmarkTag = v.InferOutput<typeof bookmarkTagSchema>;
export type Tag = v.InferOutput<typeof tagSchema>;
export type PaginationInfo = v.InferOutput<typeof paginationSchema>;
export type Bookmark = v.InferOutput<typeof bookmarkSchema>;
export type BookmarksResponse = v.InferOutput<typeof bookmarksDataSchema>;
export type TagsResponse = v.InferOutput<typeof tagsDataSchema>;
export type SubmitBookmarkResponse = PublicSubmissionResponseData;
export type ApiError = v.InferOutput<typeof apiErrorResponseSchema>;

export type Tool = Bookmark;
export type ToolsResponse = BookmarksResponse;
export type SubmitToolResponse = SubmitBookmarkResponse;

export interface GetBookmarksParams {
  limit?: number;
  offset?: number;
}

export interface SearchBookmarksParams {
  q?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

interface RequestOptions {
  signal?: AbortSignal;
}

export interface GetTagsParams {
  limit?: number;
}

export class BookmarkApiError extends Error {
  status: number;
  details?: Record<string, string[]>;

  constructor(message: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.name = "BookmarkApiError";
    this.status = status;
    this.details = details;
  }
}

function throwApiError(json: unknown, status: number): never {
  const parsed = v.safeParse(apiErrorResponseSchema, json);
  throw new BookmarkApiError(
    parsed.success ? parsed.output.error : "An unexpected error occurred",
    status,
    parsed.success ? parsed.output.details : undefined,
  );
}

function getNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `request-${Date.now()}`;
}

async function fetchValidatedResponse<T>(
  path: string,
  schema: v.BaseSchema<unknown, { success: true; data: T }, v.BaseIssue<unknown>>,
  options: RequestInit & RequestOptions = {},
): Promise<T> {
  const requestId = createRequestId();
  const startTime = getNow();

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, options);
    const json = await response.json();
    const durationMs = Math.round(getNow() - startTime);

    console.info("[perf] client-request", {
      requestId,
      path,
      durationMs,
      status: response.status,
      ok: response.ok,
      aborted: false,
    });

    if (!response.ok) {
      throwApiError(json, response.status);
    }

    const result = v.safeParse(schema, json);
    if (!result.success) {
      throw new BookmarkApiError("Invalid response from server", 500);
    }

    return result.output.data;
  } catch (error) {
    const durationMs = Math.round(getNow() - startTime);
    const aborted = error instanceof DOMException && error.name === "AbortError";

    console.info("[perf] client-request", {
      requestId,
      path,
      durationMs,
      aborted,
      error: error instanceof Error ? error.message : "Unexpected request failure",
    });

    throw error;
  }
}

function appendListParams(
  path: string,
  params: GetBookmarksParams | SearchBookmarksParams | GetTagsParams,
): string {
  const searchParams = new URLSearchParams();

  if ("q" in params && params.q) {
    searchParams.set("q", params.q);
  }
  if ("tags" in params && params.tags && params.tags.length > 0) {
    searchParams.set("tags", params.tags.join(","));
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if ("offset" in params && params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  const queryString = searchParams.toString();
  return `${path}${queryString ? `?${queryString}` : ""}`;
}

export async function getBookmarks(params: GetBookmarksParams = {}): Promise<BookmarksResponse> {
  return fetchValidatedResponse(appendListParams("/api/tools", params), bookmarksResponseSchema);
}

export async function searchBookmarks(
  params: SearchBookmarksParams = {},
  options: RequestOptions = {},
): Promise<BookmarksResponse> {
  return fetchValidatedResponse(
    appendListParams("/api/tools/search", params),
    bookmarksResponseSchema,
    { signal: options.signal },
  );
}

export async function getTags(
  params: GetTagsParams = {},
  options: RequestOptions = {},
): Promise<TagsResponse> {
  return fetchValidatedResponse(appendListParams("/api/tools/tags", params), tagsResponseSchema, {
    signal: options.signal,
  });
}

export async function submitBookmark(data: BookmarkRequest): Promise<SubmitBookmarkResponse> {
  try {
    return await submitPublicSubmission({ ...data, type: "tool" });
  } catch (error) {
    if (error instanceof PublicSubmissionApiError) {
      throw new BookmarkApiError(error.message, error.status, error.details);
    }

    throw error;
  }
}

export const getTools = getBookmarks;
export const searchTools = searchBookmarks;
export const getToolTags = getTags;
export const submitTool = submitBookmark;

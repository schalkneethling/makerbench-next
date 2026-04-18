import { z } from "zod";
import type { BookmarkRequest } from "../lib/validation";

/**
 * Gets the base URL for API requests.
 * Uses relative URLs in browser, absolute in Node.js (tests).
 */
function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  // Node.js environment (tests) - use localhost
  return process.env.API_BASE_URL || "http://localhost:8888";
}

// ============================================================================
// Zod Schemas - Single source of truth for both validation and types
// ============================================================================

const bookmarkTagSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  usageCount: z.number().int().nonnegative().optional(),
});

const paginationSchema = z.object({
  total: z.number().nullable().optional(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});

const bookmarkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  // nullable (not optional) - API explicitly returns null from DB, not undefined
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  submitterName: z.string().nullable(),
  submitterGithubUrl: z.string().nullable(),
  createdAt: z.string(),
  tags: z.array(bookmarkTagSchema),
});

const bookmarksDataSchema = z.object({
  bookmarks: z.array(bookmarkSchema),
  pagination: paginationSchema,
});

const tagsDataSchema = z.object({
  tags: z.array(tagSchema),
});

const bookmarksResponseSchema = z.object({
  success: z.literal(true),
  data: bookmarksDataSchema,
});

const submitDataSchema = z.object({
  bookmarkId: z.string(),
  message: z.string(),
});

const submitResponseSchema = z.object({
  success: z.literal(true),
  data: submitDataSchema,
});

const tagsResponseSchema = z.object({
  success: z.literal(true),
  data: tagsDataSchema,
});

const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.record(z.array(z.string())).optional(),
});

// ============================================================================
// Types - Inferred from Zod schemas (for validated data)
// ============================================================================

export type BookmarkTag = z.infer<typeof bookmarkTagSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type PaginationInfo = z.infer<typeof paginationSchema>;
export type Bookmark = z.infer<typeof bookmarkSchema>;
export type BookmarksResponse = z.infer<typeof bookmarksDataSchema>;
export type TagsResponse = z.infer<typeof tagsDataSchema>;
export type SubmitBookmarkResponse = z.infer<typeof submitDataSchema>;
export type ApiError = z.infer<typeof errorResponseSchema>;

// Function parameter types (no runtime validation needed - we control the input)
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

// ============================================================================
// Error Class
// ============================================================================

/**
 * Custom error class for API errors
 */
export class BookmarkApiError extends Error {
  status: number;
  details?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "BookmarkApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Throws a BookmarkApiError, extracting structured error details if available.
 * @param json - Response body to parse for error details
 * @param status - HTTP status code
 * @throws BookmarkApiError always
 */
function throwApiError(json: unknown, status: number): never {
  const parsed = errorResponseSchema.safeParse(json);
  throw new BookmarkApiError(
    parsed.success ? parsed.data.error : "An unexpected error occurred",
    status,
    parsed.success ? parsed.data.details : undefined,
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
  schema: z.ZodSchema<{ success: true; data: T }>,
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

    const result = schema.safeParse(json);
    if (!result.success) {
      throw new BookmarkApiError("Invalid response from server", 500);
    }

    return result.data.data;
  } catch (error) {
    const durationMs = Math.round(getNow() - startTime);
    const aborted =
      error instanceof DOMException && error.name === "AbortError";

    console.info("[perf] client-request", {
      requestId,
      path,
      durationMs,
      aborted,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected request failure",
    });

    throw error;
  }
}

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Fetches paginated bookmarks from the API
 * @param params - Optional pagination parameters
 * @returns Bookmarks with pagination info
 * @throws BookmarkApiError on API errors
 */
export async function getBookmarks(
  params: GetBookmarksParams = {},
): Promise<BookmarksResponse> {
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  const queryString = searchParams.toString();
  const path = `/api/bookmarks${queryString ? `?${queryString}` : ""}`;

  return fetchValidatedResponse(path, bookmarksResponseSchema);
}

/**
 * Searches bookmarks by query and/or tags
 * @param params - Search parameters
 * @returns Matching bookmarks with pagination info
 * @throws BookmarkApiError on API errors
 */
export async function searchBookmarks(
  params: SearchBookmarksParams = {},
  options: RequestOptions = {},
): Promise<BookmarksResponse> {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }
  if (params.tags && params.tags.length > 0) {
    searchParams.set("tags", params.tags.join(","));
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  const queryString = searchParams.toString();
  const path = `/api/bookmarks/search${queryString ? `?${queryString}` : ""}`;

  return fetchValidatedResponse(path, bookmarksResponseSchema, {
    signal: options.signal,
  });
}

/**
 * Fetches tags for the homepage filter UI.
 * @returns Available tags with optional usage counts
 * @throws BookmarkApiError on API errors
 */
export async function getTags(): Promise<TagsResponse> {
  return fetchValidatedResponse("/api/tags", tagsResponseSchema);
}

/**
 * Submits a new bookmark for review
 * @param data - Bookmark submission data
 * @returns Submission confirmation with bookmark ID
 * @throws BookmarkApiError on API errors
 */
export async function submitBookmark(
  data: BookmarkRequest,
): Promise<SubmitBookmarkResponse> {
  // Transform username to full GitHub URL for API
  const payload = {
    ...data,
    submitterGithubUrl: data.submitterGithubUsername
      ? `https://github.com/${data.submitterGithubUsername}`
      : undefined,
  };
  // Remove the username field - API expects the URL
  delete (payload as Record<string, unknown>).submitterGithubUsername;

  const response = await fetch(`${getBaseUrl()}/api/bookmarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  // HTTP error - extract structured error if available
  if (!response.ok) {
    throwApiError(json, response.status);
  }

  // HTTP success - validate expected shape
  const result = submitResponseSchema.safeParse(json);
  if (!result.success) {
    // Server returned 2xx but body doesn't match - this is a bug
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return result.data.data;
}

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

const paginationSchema = z.object({
  total: z.number(),
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
  createdAt: z.string(),
  tags: z.array(bookmarkTagSchema),
});

const bookmarksDataSchema = z.object({
  bookmarks: z.array(bookmarkSchema),
  pagination: paginationSchema,
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

const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.record(z.array(z.string())).optional(),
});

// ============================================================================
// Types - Inferred from Zod schemas (for validated data)
// ============================================================================

export type BookmarkTag = z.infer<typeof bookmarkTagSchema>;
export type PaginationInfo = z.infer<typeof paginationSchema>;
export type Bookmark = z.infer<typeof bookmarkSchema>;
export type BookmarksResponse = z.infer<typeof bookmarksDataSchema>;
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

  const response = await fetch(`${getBaseUrl()}${path}`);
  const json = await response.json();

  if (!response.ok) {
    const errorResult = errorResponseSchema.safeParse(json);
    if (errorResult.success) {
      throw new BookmarkApiError(
        errorResult.data.error,
        response.status,
        errorResult.data.details,
      );
    }
    throw new BookmarkApiError("An unexpected error occurred", response.status);
  }

  const result = bookmarksResponseSchema.safeParse(json);
  if (!result.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return result.data.data;
}

/**
 * Searches bookmarks by query and/or tags
 * @param params - Search parameters
 * @returns Matching bookmarks with pagination info
 * @throws BookmarkApiError on API errors
 */
export async function searchBookmarks(
  params: SearchBookmarksParams = {},
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

  const response = await fetch(`${getBaseUrl()}${path}`);
  const json = await response.json();

  if (!response.ok) {
    const errorResult = errorResponseSchema.safeParse(json);
    if (errorResult.success) {
      throw new BookmarkApiError(
        errorResult.data.error,
        response.status,
        errorResult.data.details,
      );
    }
    throw new BookmarkApiError("An unexpected error occurred", response.status);
  }

  const result = bookmarksResponseSchema.safeParse(json);
  if (!result.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return result.data.data;
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
  const response = await fetch(`${getBaseUrl()}/api/bookmarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const json = await response.json();

  if (!response.ok) {
    const errorResult = errorResponseSchema.safeParse(json);
    if (errorResult.success) {
      throw new BookmarkApiError(
        errorResult.data.error,
        response.status,
        errorResult.data.details,
      );
    }
    throw new BookmarkApiError("An unexpected error occurred", response.status);
  }

  const result = submitResponseSchema.safeParse(json);
  if (!result.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return result.data.data;
}

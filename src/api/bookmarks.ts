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

/**
 * Tag associated with a bookmark
 */
export interface BookmarkTag {
  id: string;
  name: string;
}

/**
 * Bookmark data returned from API
 */
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  tags: BookmarkTag[];
}

/**
 * Pagination info returned from API
 */
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Response from getBookmarks and searchBookmarks
 */
export interface BookmarksResponse {
  bookmarks: Bookmark[];
  pagination: PaginationInfo;
}

/**
 * Response from submitBookmark
 */
export interface SubmitBookmarkResponse {
  bookmarkId: string;
  message: string;
}

/**
 * API error response
 */
export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

/**
 * Parameters for getBookmarks
 */
export interface GetBookmarksParams {
  limit?: number;
  offset?: number;
}

/**
 * Parameters for searchBookmarks
 */
export interface SearchBookmarksParams {
  q?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// Zod schemas for runtime validation
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
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  createdAt: z.string(),
  tags: z.array(bookmarkTagSchema),
});

const bookmarksResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    bookmarks: z.array(bookmarkSchema),
    pagination: paginationSchema,
  }),
});

const submitResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    bookmarkId: z.string(),
    message: z.string(),
  }),
});

const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.record(z.array(z.string())).optional(),
});

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


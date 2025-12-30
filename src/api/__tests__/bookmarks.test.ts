import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import {
  getBookmarks,
  searchBookmarks,
  submitBookmark,
  BookmarkApiError,
} from "../bookmarks";

// Base URL must match the one used in bookmarks.ts for Node.js environment
const API_BASE = "http://localhost:8888";

// Mock bookmark data
const mockBookmarks = [
  {
    id: "b1",
    url: "https://example.com/tool-1",
    title: "Tool One",
    description: "A great tool",
    imageUrl: "https://example.com/image1.png",
    createdAt: "2024-01-15T10:00:00Z",
    tags: [
      { id: "t1", name: "javascript" },
      { id: "t2", name: "react" },
    ],
  },
  {
    id: "b2",
    url: "https://example.com/tool-2",
    title: "Tool Two",
    description: null,
    imageUrl: null,
    createdAt: "2024-01-14T10:00:00Z",
    tags: [{ id: "t1", name: "javascript" }],
  },
];

/**
 * Creates the GET /api/bookmarks handler
 */
function createGetBookmarksHandler() {
  return http.get(`${API_BASE}/api/bookmarks`, ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const paginatedBookmarks = mockBookmarks.slice(offset, offset + limit);

    return HttpResponse.json({
      success: true,
      data: {
        bookmarks: paginatedBookmarks,
        pagination: {
          total: mockBookmarks.length,
          limit,
          offset,
          hasMore: offset + paginatedBookmarks.length < mockBookmarks.length,
        },
      },
    });
  });
}

/**
 * Creates the GET /api/bookmarks/search handler
 */
function createSearchBookmarksHandler() {
  return http.get(`${API_BASE}/api/bookmarks/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase() || "";
    const tagsParam = url.searchParams.get("tags") || "";
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const tagFilters = tagsParam
      .split(",")
      .filter((t) => t.length > 0)
      .map((t) => t.toLowerCase());

    let filtered = [...mockBookmarks];

    if (q) {
      filtered = filtered.filter((b) => b.title?.toLowerCase().includes(q));
    }

    if (tagFilters.length > 0) {
      filtered = filtered.filter((b) =>
        b.tags.some((tag) => tagFilters.includes(tag.name.toLowerCase())),
      );
    }

    const paginatedResults = filtered.slice(offset, offset + limit);

    return HttpResponse.json({
      success: true,
      data: {
        bookmarks: paginatedResults,
        pagination: {
          total: filtered.length,
          limit,
          offset,
          hasMore: offset + paginatedResults.length < filtered.length,
        },
      },
    });
  });
}

/**
 * Creates the POST /api/bookmarks handler
 */
function createSubmitBookmarkHandler() {
  return http.post(`${API_BASE}/api/bookmarks`, async ({ request }) => {
    const body = (await request.json()) as { url?: string; tags?: string[] };

    // Validate URL is present
    if (!body.url) {
      return HttpResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: { url: ["URL is required"] },
        },
        { status: 422 },
      );
    }

    // Check for duplicate
    if (body.url === "https://example.com/duplicate") {
      return HttpResponse.json(
        {
          success: false,
          error: "This URL has already been submitted",
        },
        { status: 409 },
      );
    }

    return HttpResponse.json(
      {
        success: true,
        data: {
          bookmarkId: "new-bookmark-id",
          message: "Bookmark submitted. It will be reviewed shortly.",
        },
      },
      { status: 201 },
    );
  });
}

// Add handlers before each test, reset after
beforeEach(() => {
  server.use(
    createGetBookmarksHandler(),
    createSearchBookmarksHandler(),
    createSubmitBookmarkHandler(),
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("getBookmarks", () => {
  it("fetches bookmarks with default pagination", async () => {
    const result = await getBookmarks();

    expect(result.bookmarks).toHaveLength(2);
    expect(result.bookmarks[0].title).toBe("Tool One");
    expect(result.pagination.total).toBe(2);
    expect(result.pagination.limit).toBe(20);
    expect(result.pagination.offset).toBe(0);
  });

  it("respects custom limit and offset", async () => {
    const result = await getBookmarks({ limit: 1, offset: 0 });

    expect(result.bookmarks).toHaveLength(1);
    expect(result.bookmarks[0].id).toBe("b1");
    expect(result.pagination.hasMore).toBe(true);
  });

  it("handles empty results", async () => {
    const result = await getBookmarks({ limit: 20, offset: 100 });

    expect(result.bookmarks).toHaveLength(0);
    expect(result.pagination.hasMore).toBe(false);
  });

  it("throws BookmarkApiError on server error", async () => {
    server.use(
      http.get(`${API_BASE}/api/bookmarks`, () => {
        return HttpResponse.json(
          { success: false, error: "Database connection failed" },
          { status: 500 },
        );
      }),
    );

    await expect(getBookmarks()).rejects.toThrow(BookmarkApiError);
  });
});

describe("searchBookmarks", () => {
  it("searches by query string", async () => {
    const result = await searchBookmarks({ q: "one" });

    expect(result.bookmarks).toHaveLength(1);
    expect(result.bookmarks[0].title).toBe("Tool One");
  });

  it("filters by tags", async () => {
    const result = await searchBookmarks({ tags: ["react"] });

    expect(result.bookmarks).toHaveLength(1);
    expect(result.bookmarks[0].tags).toContainEqual({ id: "t2", name: "react" });
  });

  it("combines query and tag filters", async () => {
    const result = await searchBookmarks({ q: "tool", tags: ["javascript"] });

    expect(result.bookmarks).toHaveLength(2);
  });

  it("returns empty results for no matches", async () => {
    const result = await searchBookmarks({ q: "nonexistent" });

    expect(result.bookmarks).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it("handles pagination in search results", async () => {
    const result = await searchBookmarks({ q: "tool", limit: 1 });

    expect(result.bookmarks).toHaveLength(1);
    expect(result.pagination.hasMore).toBe(true);
  });
});

describe("submitBookmark", () => {
  it("submits a valid bookmark", async () => {
    const result = await submitBookmark({
      url: "https://example.com/new-tool",
      tags: ["typescript"],
    });

    expect(result.bookmarkId).toBe("new-bookmark-id");
    expect(result.message).toContain("submitted");
  });

  it("throws on validation error with details", async () => {
    try {
      await submitBookmark({
        url: "",
        tags: ["test"],
      });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BookmarkApiError);
      const apiError = error as BookmarkApiError;
      expect(apiError.status).toBe(422);
      expect(apiError.details).toHaveProperty("url");
    }
  });

  it("throws on duplicate URL", async () => {
    try {
      await submitBookmark({
        url: "https://example.com/duplicate",
        tags: ["test"],
      });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BookmarkApiError);
      const apiError = error as BookmarkApiError;
      expect(apiError.status).toBe(409);
      expect(apiError.message).toContain("already been submitted");
    }
  });
});

describe("BookmarkApiError", () => {
  it("includes status and optional details", () => {
    const error = new BookmarkApiError("Test error", 400, { field: ["issue"] });

    expect(error.message).toBe("Test error");
    expect(error.status).toBe(400);
    expect(error.details).toEqual({ field: ["issue"] });
    expect(error.name).toBe("BookmarkApiError");
  });
});

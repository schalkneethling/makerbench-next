import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "@netlify/functions";
import type { ErrorResponse, SuccessResponse } from "../lib/responses";

/** Bookmark shape returned from search */
interface BookmarkWithTags {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  tags: { id: string; name: string }[];
}

/** Pagination metadata */
interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Success data shape for search-bookmarks */
interface SearchResultsData {
  bookmarks: BookmarkWithTags[];
  pagination: Pagination;
}

// Mock the database module
vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

import searchBookmarks from "../search-bookmarks.mts";
import { getDb } from "../lib/db";

/**
 * Creates a mock Netlify Context object
 */
function createMockContext(): Context {
  return {
    account: { id: "test-account" },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    deploy: { context: "dev", id: "test-deploy", published: false },
    geo: {},
    ip: "127.0.0.1",
    params: {},
    requestId: "test-request-id",
    server: { region: "us-east-1" },
    site: { id: "test-site", name: "test", url: "https://test.netlify.app" },
    json: vi.fn(),
    log: vi.fn(),
  } as unknown as Context;
}

/**
 * Creates a mock database with chainable query methods
 */
function createMockDb() {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    selectDistinct: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  };
  return mockDb;
}

describe("search-bookmarks", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockContext: Context;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );
    mockContext = createMockContext();
  });

  describe("validation", () => {
    it("returns 405 for non-GET requests", async () => {
      const req = new Request("https://test.com/api/bookmarks/search", {
        method: "POST",
      });

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(405);
    });

    it("returns 400 for invalid limit", async () => {
      const req = new Request(
        "https://test.com/api/bookmarks/search?limit=abc",
      );

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toContain("limit");
    });

    it("returns 400 for invalid offset", async () => {
      const req = new Request(
        "https://test.com/api/bookmarks/search?offset=-1",
      );

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(400);
    });
  });

  describe("search functionality", () => {
    it("returns empty results when no bookmarks match", async () => {
      // Count query
      mockDb.where.mockResolvedValueOnce([{ total: 0 }]);
      // Bookmarks query
      mockDb.offset.mockResolvedValueOnce([]);

      const req = new Request("https://test.com/api/bookmarks/search?q=xyz");

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<SearchResultsData>;
      expect(body.success).toBe(true);
      expect(body.data.bookmarks).toEqual([]);
      expect(body.data.pagination.total).toBe(0);
    });

    it("searches by query string in title", async () => {
      // Count query
      mockDb.where.mockResolvedValueOnce([{ total: 1 }]);
      // Bookmarks query
      mockDb.offset.mockResolvedValueOnce([
        {
          bookmark: {
            id: "b1",
            url: "https://react.dev",
            title: "React Documentation",
            description: "Official React docs",
            imageUrl: null,
            createdAt: "2024-01-01",
            status: "approved",
          },
          tagId: "t1",
          tagName: "react",
        },
      ]);

      const req = new Request("https://test.com/api/bookmarks/search?q=React");

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<SearchResultsData>;
      expect(body.data.bookmarks).toHaveLength(1);
      expect(body.data.bookmarks[0].title).toContain("React");
    });

    it("returns empty when tag filter has no matches", async () => {
      // Tag lookup returns no matching bookmark IDs
      mockDb.where.mockResolvedValueOnce([]);

      const req = new Request(
        "https://test.com/api/bookmarks/search?tags=nonexistent",
      );

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<SearchResultsData>;
      expect(body.data.bookmarks).toEqual([]);
      expect(body.data.pagination.total).toBe(0);
    });

    it("filters by tags (comma-separated)", async () => {
      // Tag lookup returns matching bookmark IDs
      mockDb.where.mockResolvedValueOnce([{ bookmarkId: "b1" }]);
      // Count query
      mockDb.where.mockResolvedValueOnce([{ total: 1 }]);
      // Bookmarks query
      mockDb.offset.mockResolvedValueOnce([
        {
          bookmark: {
            id: "b1",
            url: "https://example.com",
            title: "Example",
            description: "Desc",
            imageUrl: null,
            createdAt: "2024-01-01",
            status: "approved",
          },
          tagId: "t1",
          tagName: "javascript",
        },
      ]);

      const req = new Request(
        "https://test.com/api/bookmarks/search?tags=javascript,react",
      );

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<SearchResultsData>;
      expect(body.data.bookmarks).toHaveLength(1);
    });

    it("combines query and tag filters", async () => {
      // Tag lookup
      mockDb.where.mockResolvedValueOnce([{ bookmarkId: "b1" }]);
      // Count query
      mockDb.where.mockResolvedValueOnce([{ total: 1 }]);
      // Bookmarks query
      mockDb.offset.mockResolvedValueOnce([
        {
          bookmark: {
            id: "b1",
            url: "https://react.dev",
            title: "React Hooks Guide",
            description: "Learn hooks",
            imageUrl: null,
            createdAt: "2024-01-01",
            status: "approved",
          },
          tagId: "t1",
          tagName: "react",
        },
      ]);

      const req = new Request(
        "https://test.com/api/bookmarks/search?q=hooks&tags=react",
      );

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<SearchResultsData>;
      expect(body.data.bookmarks).toHaveLength(1);
    });
  });

  describe("pagination", () => {
    it("returns pagination info with hasMore=true when more results exist", async () => {
      mockDb.where.mockResolvedValueOnce([{ total: 50 }]);
      mockDb.offset.mockResolvedValueOnce([
        {
          bookmark: {
            id: "b1",
            url: "https://example.com",
            title: "Example",
            description: null,
            imageUrl: null,
            createdAt: "2024-01-01",
            status: "approved",
          },
          tagId: null,
          tagName: null,
        },
      ]);

      const req = new Request(
        "https://test.com/api/bookmarks/search?limit=10&offset=0",
      );

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<SearchResultsData>;
      expect(body.data.pagination.total).toBe(50);
      expect(body.data.pagination.hasMore).toBe(true);
    });

    it("returns hasMore=false when at end of results", async () => {
      mockDb.where.mockResolvedValueOnce([{ total: 5 }]);
      mockDb.offset.mockResolvedValueOnce([
        {
          bookmark: {
            id: "b1",
            url: "https://example.com",
            title: "Example",
            description: null,
            imageUrl: null,
            createdAt: "2024-01-01",
            status: "approved",
          },
          tagId: null,
          tagName: null,
        },
      ]);

      const req = new Request(
        "https://test.com/api/bookmarks/search?limit=10&offset=4",
      );

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<SearchResultsData>;
      expect(body.data.pagination.hasMore).toBe(false);
    });
  });
});

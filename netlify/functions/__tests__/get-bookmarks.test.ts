import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "@netlify/functions";
import type { ErrorResponse, SuccessResponse } from "../lib/responses";

/** Bookmark shape returned from get-bookmarks */
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

/** Success data shape for get-bookmarks */
interface BookmarksListData {
  bookmarks: BookmarkWithTags[];
  pagination: Pagination;
}

// Mock the database module
vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

import getBookmarks from "../get-bookmarks.mts";
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
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };
  return mockDb;
}

describe("get-bookmarks", () => {
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
      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
      });

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(405);
    });

    it("returns 400 for invalid limit", async () => {
      // Mock count query
      mockDb.where.mockResolvedValueOnce([{ total: 10 }]);

      const req = new Request("https://test.com/api/bookmarks?limit=abc");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toContain("limit");
    });

    it("returns 400 for negative limit", async () => {
      mockDb.where.mockResolvedValueOnce([{ total: 10 }]);

      const req = new Request("https://test.com/api/bookmarks?limit=-5");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid offset", async () => {
      mockDb.where.mockResolvedValueOnce([{ total: 10 }]);

      const req = new Request("https://test.com/api/bookmarks?offset=abc");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toContain("offset");
    });

    it("returns 400 for negative offset", async () => {
      mockDb.where.mockResolvedValueOnce([{ total: 10 }]);

      const req = new Request("https://test.com/api/bookmarks?offset=-1");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(400);
    });
  });

  describe("successful retrieval", () => {
    it("returns 200 with empty bookmarks array", async () => {
      // First call: count query
      mockDb.where.mockResolvedValueOnce([{ total: 0 }]);
      // Second call: bookmarks query
      mockDb.offset.mockResolvedValueOnce([]);

      const req = new Request("https://test.com/api/bookmarks");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<BookmarksListData>;
      expect(body.success).toBe(true);
      expect(body.data.bookmarks).toEqual([]);
      expect(body.data.pagination.total).toBe(0);
    });

    it("returns bookmarks with pagination info", async () => {
      // Count query
      mockDb.where.mockResolvedValueOnce([{ total: 50 }]);
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
          tagId: "t2",
          tagName: "testing",
        },
      ]);

      const req = new Request("https://test.com/api/bookmarks?limit=10");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<BookmarksListData>;
      expect(body.success).toBe(true);
      expect(body.data.bookmarks).toHaveLength(1); // Grouped by bookmark ID
      expect(body.data.bookmarks[0].tags).toHaveLength(2);
      expect(body.data.pagination.total).toBe(50);
      expect(body.data.pagination.hasMore).toBe(true);
    });

    it("respects limit parameter", async () => {
      mockDb.where.mockResolvedValueOnce([{ total: 100 }]);
      mockDb.offset.mockResolvedValueOnce([]);

      const req = new Request("https://test.com/api/bookmarks?limit=5");

      await getBookmarks(req, mockContext);

      expect(mockDb.limit).toHaveBeenCalled();
    });

    it("respects offset parameter", async () => {
      mockDb.where.mockResolvedValueOnce([{ total: 100 }]);
      mockDb.offset.mockResolvedValueOnce([]);

      const req = new Request("https://test.com/api/bookmarks?offset=20");

      await getBookmarks(req, mockContext);

      expect(mockDb.offset).toHaveBeenCalled();
    });

    it("caps limit at MAX_LIMIT (100)", async () => {
      mockDb.where.mockResolvedValueOnce([{ total: 200 }]);
      mockDb.offset.mockResolvedValueOnce([]);

      const req = new Request("https://test.com/api/bookmarks?limit=500");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<BookmarksListData>;
      expect(body.data.pagination.limit).toBe(100);
    });
  });
});

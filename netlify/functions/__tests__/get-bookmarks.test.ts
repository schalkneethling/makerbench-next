import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "@netlify/functions";
import type { ErrorResponse, SuccessResponse } from "../lib/responses";

interface BookmarkWithTags {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  tags: { id: string; name: string }[];
}

interface Pagination {
  total: number | null;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface BookmarksListData {
  bookmarks: BookmarkWithTags[];
  pagination: Pagination;
}

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

import getBookmarks from "../get-bookmarks.mts";
import { getDb } from "../lib/db";

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

function createMockDb() {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
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
      const req = new Request("https://test.com/api/bookmarks?limit=abc");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toContain("limit");
    });

    it("returns 400 for invalid offset", async () => {
      const req = new Request("https://test.com/api/bookmarks?offset=-1");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(400);
    });

    it("returns generic 503 when required env vars are missing", async () => {
      const originalGet = Netlify.env.get;
      Netlify.env.get = vi.fn((envKey: string) =>
        envKey === "TURSO_DATABASE_URL" ? undefined : originalGet(envKey),
      );

      try {
        const req = new Request("https://test.com/api/bookmarks");
        const res = await getBookmarks(req, mockContext);

        expect(res.status).toBe(503);
        const body = (await res.json()) as ErrorResponse;
        expect(body.error).toBe("Service temporarily unavailable");
      } finally {
        Netlify.env.get = originalGet;
      }
    });
  });

  describe("successful retrieval", () => {
    it("returns 200 with empty bookmarks array and null total", async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      const req = new Request("https://test.com/api/bookmarks");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<BookmarksListData>;
      expect(body.success).toBe(true);
      expect(body.data.bookmarks).toEqual([]);
      expect(body.data.pagination.total).toBeNull();
      expect(body.data.pagination.hasMore).toBe(false);
    });

    it("returns bookmarks with tag data and hasMore from limit+1", async () => {
      mockDb.offset.mockResolvedValueOnce([
        {
          id: "b1",
          url: "https://example.com",
          title: "Example",
          description: "Desc",
          imageUrl: null,
          submitterName: null,
          submitterGithubUrl: null,
          createdAt: "2024-01-01",
        },
        {
          id: "b2",
          url: "https://example2.com",
          title: "Example 2",
          description: "Desc",
          imageUrl: null,
          submitterName: null,
          submitterGithubUrl: null,
          createdAt: "2024-01-01",
        },
      ]);
      mockDb.where
        .mockImplementationOnce(() => mockDb)
        .mockResolvedValueOnce([
          { bookmarkId: "b1", tagId: "t1", tagName: "javascript" },
        ]);

      const req = new Request("https://test.com/api/bookmarks?limit=1");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<BookmarksListData>;
      expect(body.data.bookmarks).toHaveLength(1);
      expect(body.data.bookmarks[0].tags).toHaveLength(1);
      expect(body.data.pagination.total).toBeNull();
      expect(body.data.pagination.hasMore).toBe(true);
    });

    it("caps limit at MAX_LIMIT (100)", async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      const req = new Request("https://test.com/api/bookmarks?limit=500");

      const res = await getBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<BookmarksListData>;
      expect(body.data.pagination.limit).toBe(100);
    });
  });
});

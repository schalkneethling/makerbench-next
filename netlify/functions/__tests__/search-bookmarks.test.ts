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

interface SearchResultsData {
  bookmarks: BookmarkWithTags[];
  pagination: Pagination;
}

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

import searchBookmarks from "../search-bookmarks.mts";
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
    all: vi.fn().mockResolvedValue([]),
    selectDistinct: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
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

    it("returns generic 503 when required env vars are missing", async () => {
      const originalGet = Netlify.env.get;
      Netlify.env.get = vi.fn((envKey: string) =>
        envKey === "TURSO_AUTH_TOKEN" ? undefined : originalGet(envKey),
      );

      try {
        const req = new Request("https://test.com/api/bookmarks/search?q=test");
        const res = await searchBookmarks(req, mockContext);

        expect(res.status).toBe(503);
        const body = (await res.json()) as ErrorResponse;
        expect(body.error).toBe("Service temporarily unavailable");
      } finally {
        Netlify.env.get = originalGet;
      }
    });
  });

  describe("search and pagination", () => {
    it("returns empty results when no bookmarks match", async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const req = new Request("https://test.com/api/bookmarks/search?q=xyz");

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<SearchResultsData>;
      expect(body.success).toBe(true);
      expect(body.data.bookmarks).toEqual([]);
      expect(body.data.pagination.total).toBeNull();
      expect(body.data.pagination.hasMore).toBe(false);
    });

    it("returns hasMore=true when limit+1 results are found", async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: "b1", rank: 0.1 },
        { id: "b2", rank: 0.2 },
      ]);
      mockDb.groupBy.mockResolvedValueOnce([
        {
          id: "b1",
          url: "https://react.dev",
          title: "React Docs",
          description: null,
          imageUrl: null,
          submitterName: null,
          submitterGithubUrl: null,
          createdAt: "2024-01-01",
          tagsJson: '[{"id":"t1","name":"react"}]',
        },
      ]);

      const req = new Request(
        "https://test.com/api/bookmarks/search?q=react&limit=1",
      );

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<SearchResultsData>;
      expect(body.data.bookmarks).toHaveLength(1);
      expect(body.data.bookmarks[0].tags).toContainEqual({
        id: "t1",
        name: "react",
      });
      expect(body.data.pagination.total).toBeNull();
      expect(body.data.pagination.hasMore).toBe(true);
    });

    it("supports tag filter requests", async () => {
      mockDb.offset.mockResolvedValueOnce([
        {
          id: "b1",
        },
      ]);
      mockDb.groupBy.mockResolvedValueOnce([
        {
          id: "b1",
          url: "https://example.com",
          title: "Example",
          description: null,
          imageUrl: null,
          submitterName: null,
          submitterGithubUrl: null,
          createdAt: "2024-01-01",
          tagsJson: "[]",
        },
      ]);

      const req = new Request(
        "https://test.com/api/bookmarks/search?tags=javascript,react",
      );

      const res = await searchBookmarks(req, mockContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<SearchResultsData>;
      expect(body.data.bookmarks).toHaveLength(1);
      expect(body.data.pagination.hasMore).toBe(false);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "@netlify/functions";
import type { ErrorResponse, SuccessResponse } from "../lib/responses";

interface PublicResource {
  id: string;
  url: string;
  title: string;
  description: string | null;
  tags: { id: string; name: string }[];
  createdAt: string;
  kind: "article" | "resource" | "stack";
  children?: Array<{
    id: string;
    url: string;
    title: string;
    description: string | null;
    tags: { id: string; name: string }[];
  }>;
}

interface Pagination {
  total: number | null;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface SearchResultsData {
  resources: PublicResource[];
  pagination: Pagination;
}

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

import searchResources from "../search-resources.mts";
import { getDb } from "../lib/db";
import { getPgQuery } from "./test-utils";

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
  return {
    execute: vi.fn(),
  };
}

describe("search-resources", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockContext: Context;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);
    mockContext = createMockContext();
  });

  describe("validation", () => {
    it("returns 405 for non-GET requests", async () => {
      const req = new Request("https://test.com/api/resources/search", {
        method: "POST",
      });

      const res = await searchResources(req, mockContext);

      expect(res.status).toBe(405);
    });

    it("returns 400 for invalid offset", async () => {
      const req = new Request("https://test.com/api/resources/search?offset=-1");

      const res = await searchResources(req, mockContext);

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toContain("offset");
    });
  });

  it("returns accurate totals for SQL-filtered resource searches", async () => {
    mockDb.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "stack-1",
            url: "https://example.com/stack",
            title: "Automation Stack",
            description: null,
            tags: ["workflow"],
            created_at: "2024-01-03T00:00:00.000Z",
            kind: "stack",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "stack-item-1",
            public_stack_id: "stack-1",
            url: "https://example.com/child",
            title: "Child",
            description: null,
            tags: ["automation"],
            status: "approved",
          },
        ],
      });

    const req = new Request(
      "https://test.com/api/resources/search?q=automation&tags=workflow&limit=1",
    );

    const res = await searchResources(req, mockContext);

    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessResponse<SearchResultsData>;
    expect(body.data.resources).toHaveLength(1);
    expect(body.data.resources[0].children).toHaveLength(1);
    expect(body.data.pagination).toEqual({
      total: 2,
      limit: 1,
      offset: 0,
      hasMore: true,
    });
    expect(mockDb.execute).toHaveBeenCalledTimes(3);

    const pageSql = getPgQuery(mockDb.execute.mock.calls[0]?.[0]).sql;
    const countSql = getPgQuery(mockDb.execute.mock.calls[1]?.[0]).sql;
    const childrenSql = getPgQuery(mockDb.execute.mock.calls[2]?.[0]).sql;
    expect(pageSql).toContain("where public_listings.status = 'approved'");
    expect(pageSql).toContain("where public_stacks.status = 'approved'");
    expect(countSql).toContain("where public_listings.status = 'approved'");
    expect(countSql).toContain("where public_stacks.status = 'approved'");
    expect(childrenSql).toContain("and public_stack_items.status = 'approved'");
  });

  it("does not hydrate non-approved stack item rows", async () => {
    mockDb.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "stack-1",
            url: "https://example.com/stack",
            title: "Automation Stack",
            description: null,
            tags: ["workflow"],
            created_at: "2024-01-03T00:00:00.000Z",
            kind: "stack",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "stack-item-pending",
            public_stack_id: "stack-1",
            url: "https://example.com/pending",
            title: "Pending Child",
            description: null,
            tags: ["automation"],
            status: "pending",
          },
          {
            id: "stack-item-rejected",
            public_stack_id: "stack-1",
            url: "https://example.com/rejected",
            title: "Rejected Child",
            description: null,
            tags: ["automation"],
            status: "rejected",
          },
        ],
      });

    const req = new Request("https://test.com/api/resources/search?q=automation&limit=1");

    const res = await searchResources(req, mockContext);

    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessResponse<SearchResultsData>;
    expect(body.data.resources).toHaveLength(1);
    expect(body.data.resources[0]).toMatchObject({
      id: "stack-1",
      kind: "stack",
      children: [],
    });
    expect(body.data.pagination).toEqual({
      total: 1,
      limit: 1,
      offset: 0,
      hasMore: false,
    });
    expect(mockDb.execute).toHaveBeenCalledTimes(3);
  });

  it("returns an empty page with total zero when SQL search finds no resources", async () => {
    mockDb.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const req = new Request("https://test.com/api/resources/search?q=missing");

    const res = await searchResources(req, mockContext);

    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessResponse<SearchResultsData>;
    expect(body.data.resources).toEqual([]);
    expect(body.data.pagination.total).toBe(0);
    expect(body.data.pagination.hasMore).toBe(false);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  it("preserves article kinds for matching public listings", async () => {
    mockDb.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "article-1",
            url: "https://example.com/article",
            title: "Article",
            description: "Useful reading",
            tags: ["reading"],
            created_at: "2024-01-04T00:00:00.000Z",
            kind: "article",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const req = new Request("https://test.com/api/resources/search?q=article");

    const res = await searchResources(req, mockContext);

    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessResponse<SearchResultsData>;
    expect(body.data.resources).toEqual([
      {
        id: "article-1",
        url: "https://example.com/article",
        title: "Article",
        description: "Useful reading",
        tags: [{ id: "reading", name: "reading" }],
        createdAt: "2024-01-04T00:00:00.000Z",
        kind: "article",
      },
    ]);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });
});

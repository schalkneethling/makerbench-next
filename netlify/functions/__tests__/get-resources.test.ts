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

interface ResourcesListData {
  resources: PublicResource[];
  pagination: Pagination;
}

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

import getResources from "../get-resources.mts";
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
  return {
    execute: vi.fn(),
  };
}

describe("get-resources", () => {
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
      const req = new Request("https://test.com/api/resources", {
        method: "POST",
      });

      const res = await getResources(req, mockContext);

      expect(res.status).toBe(405);
    });

    it("returns 400 for invalid limit", async () => {
      const req = new Request("https://test.com/api/resources?limit=abc");

      const res = await getResources(req, mockContext);

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toContain("limit");
    });
  });

  it("paginates mixed public resources in Postgres and hydrates visible stacks", async () => {
    mockDb.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "stack-1",
            url: "https://example.com/stack",
            title: "Stack",
            description: "Stack description",
            tags: ["workflow"],
            created_at: "2024-01-03T00:00:00.000Z",
            kind: "stack",
          },
          {
            id: "listing-1",
            url: "https://example.com/article",
            title: "Article",
            description: null,
            tags: ["design"],
            created_at: "2024-01-02T00:00:00.000Z",
            kind: "article",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 3 }] })
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

    const req = new Request("https://test.com/api/resources?limit=2");

    const res = await getResources(req, mockContext);

    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessResponse<ResourcesListData>;
    expect(body.data.resources).toEqual([
      {
        id: "stack-1",
        url: "https://example.com/stack",
        title: "Stack",
        description: "Stack description",
        tags: [{ id: "workflow", name: "workflow" }],
        createdAt: "2024-01-03T00:00:00.000Z",
        kind: "stack",
        children: [
          {
            id: "stack-item-1",
            url: "https://example.com/child",
            title: "Child",
            description: null,
            tags: [{ id: "automation", name: "automation" }],
          },
        ],
      },
      {
        id: "listing-1",
        url: "https://example.com/article",
        title: "Article",
        description: null,
        tags: [{ id: "design", name: "design" }],
        createdAt: "2024-01-02T00:00:00.000Z",
        kind: "article",
      },
    ]);
    expect(body.data.pagination).toEqual({
      total: 3,
      limit: 2,
      offset: 0,
      hasMore: true,
    });
    expect(mockDb.execute).toHaveBeenCalledTimes(3);
  });

  it("does not query stack items when the page contains no stacks", async () => {
    mockDb.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "listing-1",
            url: "https://example.com/tool",
            title: "Tool",
            description: null,
            tags: [],
            created_at: "2024-01-02T00:00:00.000Z",
            kind: "resource",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const req = new Request("https://test.com/api/resources");

    const res = await getResources(req, mockContext);

    expect(res.status).toBe(200);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });
});

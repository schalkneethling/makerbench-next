import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@netlify/functions";
import type { ErrorResponse, SuccessResponse } from "../lib/responses";

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

import getTags from "../get-tags.mts";
import { getDb } from "../lib/db";

interface TagsResponseData {
  tags: Array<{
    id: string;
    name: string;
    usageCount: number;
  }>;
}

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
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
}

describe("get-tags", () => {
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

  it("returns 405 for non-GET requests", async () => {
    const req = new Request("https://test.com/api/tags", { method: "POST" });

    const res = await getTags(req, mockContext);

    expect(res.status).toBe(405);
  });

  it("returns generic 503 when required env vars are missing", async () => {
    const originalGet = Netlify.env.get;
    Netlify.env.get = vi.fn(() => undefined);

    try {
      const req = new Request("https://test.com/api/tags");
      const res = await getTags(req, mockContext);

      expect(res.status).toBe(503);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toBe("Service temporarily unavailable");
    } finally {
      Netlify.env.get = originalGet;
    }
  });

  it("returns tags with usage counts", async () => {
    mockDb.orderBy.mockResolvedValueOnce([
      { id: "t1", name: "react", usageCount: 2 },
      { id: "t2", name: "typescript", usageCount: 1 },
    ]);

    const req = new Request("https://test.com/api/tags");
    const res = await getTags(req, mockContext);

    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessResponse<TagsResponseData>;
    expect(body.success).toBe(true);
    expect(body.data.tags).toEqual([
      { id: "t1", name: "react", usageCount: 2 },
      { id: "t2", name: "typescript", usageCount: 1 },
    ]);
  });

  it("applies a limit when requested", async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: "t1", name: "react", usageCount: 2 },
    ]);

    const req = new Request("https://test.com/api/tags?limit=10");
    const res = await getTags(req, mockContext);

    expect(res.status).toBe(200);
    expect(mockDb.limit).toHaveBeenCalledWith(10);

    const body = (await res.json()) as SuccessResponse<TagsResponseData>;
    expect(body.data.tags).toEqual([
      { id: "t1", name: "react", usageCount: 2 },
    ]);
  });

  it("returns 400 for an invalid limit", async () => {
    const req = new Request("https://test.com/api/tags?limit=0");
    const res = await getTags(req, mockContext);

    expect(res.status).toBe(400);
    expect(mockDb.limit).not.toHaveBeenCalled();
  });
});

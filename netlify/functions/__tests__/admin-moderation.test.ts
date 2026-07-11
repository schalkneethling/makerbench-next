import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  verifyAuthenticatedUser: vi.fn(),
}));

import adminModeration from "../admin-moderation.mts";
import { getDb } from "../lib/db";
import { verifyAuthenticatedUser } from "../lib/auth";
import { createMockContext } from "./test-utils";

const adminAuth = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
  },
  isAdmin: true,
};

interface ModerationQueueBody {
  data: {
    items: unknown[];
  };
}

interface ModerationReviewBody {
  data: {
    id: string;
    type: string;
    status: string;
  };
}

interface ErrorBody {
  error: string;
  details: Record<string, string[]>;
}

type ModerationUpdateCase = readonly [
  type: string,
  status: string,
  expectedTable: string,
  expectedSqlParts: readonly string[],
];

const moderationUpdateCases = [
  ["tool", "approved", "tool_listings", ["approved_at", "reviewed_by"]],
  ["resource", "approved", "public_listings", ["reviewed_by"]],
  ["stack", "approved", "public_stacks", ["reviewed_by"]],
  ["stack-item", "approved", "public_stack_items", ["reviewed_by"]],
  [
    "tool",
    "rejected",
    "tool_listings",
    ["approved_at", "rejection_code", "rejection_reason"],
  ],
  [
    "resource",
    "rejected",
    "public_listings",
    ["rejection_code", "rejection_reason"],
  ],
  [
    "stack",
    "rejected",
    "public_stacks",
    ["rejection_code", "rejection_reason"],
  ],
  [
    "stack-item",
    "rejected",
    "public_stack_items",
    ["rejection_code", "rejection_reason"],
  ],
] satisfies readonly ModerationUpdateCase[];

function createExecuteDb(rows: unknown[]) {
  return {
    execute: vi.fn().mockResolvedValue({ rows }),
  };
}

function getSqlText(query: unknown): string {
  if (!query || typeof query !== "object") {
    return "";
  }

  if ("value" in query && Array.isArray(query.value)) {
    return query.value.join("");
  }

  const queryChunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];

  return queryChunks.map(getSqlText).join("");
}

function getSqlParams(query: unknown): unknown[] {
  if (!query || typeof query !== "object") {
    return [];
  }

  if ("value" in query && !Array.isArray(query.value)) {
    return [query.value];
  }

  const queryChunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];

  return queryChunks.flatMap(getSqlParams);
}

describe("admin-moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue(adminAuth as never);
  });

  it.each(["GET", "PATCH"] as const)(
    "returns 401 when a %s request is not authenticated",
    async (method) => {
      vi.mocked(verifyAuthenticatedUser).mockResolvedValue(null);

      const res = await adminModeration(
        new Request("https://test.com/api/admin/moderation", { method }),
        createMockContext(),
      );

      expect(res.status).toBe(401);
      expect(getDb).not.toHaveBeenCalled();
    },
  );

  it.each(["GET", "PATCH"] as const)(
    "returns 403 when a %s request comes from a non-admin user",
    async (method) => {
      vi.mocked(verifyAuthenticatedUser).mockResolvedValue({
        ...adminAuth,
        isAdmin: false,
      } as never);

      const res = await adminModeration(
        new Request("https://test.com/api/admin/moderation", {
          method,
          headers: { Authorization: "Bearer token-1" },
        }),
        createMockContext(),
      );

      expect(res.status).toBe(403);
      expect(getDb).not.toHaveBeenCalled();
    },
  );

  it("returns 400 for an invalid moderation type filter", async () => {
    const res = await adminModeration(
      new Request("https://test.com/api/admin/moderation?type=article", {
        headers: { Authorization: "Bearer token-1" },
      }),
      createMockContext(),
    );

    expect(res.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
  });

  it.each(["tool", "resource", "stack", "stack-item"] as const)(
    "passes the %s moderation type filter to the pending-items query",
    async (type) => {
      const mockDb = createExecuteDb([]);
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const res = await adminModeration(
        new Request(
          `https://test.com/api/admin/moderation?type=${encodeURIComponent(type)}`,
          {
            headers: { Authorization: "Bearer token-1" },
          },
        ),
        createMockContext(),
      );

      expect(res.status).toBe(200);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      const query = mockDb.execute.mock.calls[0]?.[0];
      expect(getSqlText(query)).toContain("where type = ");
      expect(getSqlParams(query)).toEqual([type]);
    },
  );

  it("lists pending moderation items across entity types", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "tool-1",
            type: "tool",
            url: "https://example.com/tool",
            title: "Tool",
            description: "Tool description",
            tags: ["design"],
            submitter: "Taylor",
            submitter_url: "https://github.com/taylor",
            parent_id: null,
            parent_title: null,
            created_at: "2026-06-01T00:00:00.000Z",
          },
          {
            id: "resource-1",
            type: "resource",
            url: "https://example.com/resource",
            title: "Resource",
            description: "Resource description",
            tags: ["research"],
            submitter: "Alex Writer",
            submitter_url: "https://github.com/alexwriter",
            parent_id: null,
            parent_title: null,
            created_at: "2026-06-01T12:00:00.000Z",
          },
          {
            id: "resource-2",
            type: "resource",
            url: "https://example.com/signed-in-resource",
            title: "Signed-in resource",
            description: null,
            tags: [],
            submitter: "Signed-in user",
            submitter_url: null,
            parent_id: null,
            parent_title: null,
            created_at: "2026-06-01T18:00:00.000Z",
          },
          {
            id: "resource-3",
            type: "resource",
            url: "https://example.com/anonymous-resource",
            title: "Anonymous resource",
            description: null,
            tags: [],
            submitter: "Anonymous",
            submitter_url: null,
            parent_id: null,
            parent_title: null,
            created_at: "2026-06-01T20:00:00.000Z",
          },
          {
            id: "stack-1",
            type: "stack",
            url: "https://example.com/stack",
            title: "Stack",
            description: "Stack description",
            tags: ["workflow"],
            submitter: "11111111-1111-4111-8111-111111111111",
            submitter_url: null,
            parent_id: null,
            parent_title: null,
            created_at: "2026-06-01T22:00:00.000Z",
          },
          {
            id: "item-1",
            type: "stack-item",
            url: "https://example.com/item",
            title: "Stack item",
            description: null,
            tags: [],
            submitter: "11111111-1111-4111-8111-111111111111",
            submitter_url: null,
            parent_id: "stack-1",
            parent_title: "Stack",
            created_at: "2026-06-02T00:00:00.000Z",
          },
        ],
      }),
    };
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    const res = await adminModeration(
      new Request("https://test.com/api/admin/moderation", {
        headers: { Authorization: "Bearer token-1" },
      }),
      createMockContext(),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as ModerationQueueBody;
    expect(body.data.items).toEqual([
      {
        id: "tool-1",
        type: "tool",
        url: "https://example.com/tool",
        title: "Tool",
        description: "Tool description",
        tags: [{ id: "design", name: "design" }],
        submitter: "Taylor",
        submitterUrl: "https://github.com/taylor",
        parent: null,
        createdAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "resource-1",
        type: "resource",
        url: "https://example.com/resource",
        title: "Resource",
        description: "Resource description",
        tags: [{ id: "research", name: "research" }],
        submitter: "Alex Writer",
        submitterUrl: "https://github.com/alexwriter",
        parent: null,
        createdAt: "2026-06-01T12:00:00.000Z",
      },
      {
        id: "resource-2",
        type: "resource",
        url: "https://example.com/signed-in-resource",
        title: "Signed-in resource",
        description: null,
        tags: [],
        submitter: "Signed-in user",
        submitterUrl: null,
        parent: null,
        createdAt: "2026-06-01T18:00:00.000Z",
      },
      {
        id: "resource-3",
        type: "resource",
        url: "https://example.com/anonymous-resource",
        title: "Anonymous resource",
        description: null,
        tags: [],
        submitter: "Anonymous",
        submitterUrl: null,
        parent: null,
        createdAt: "2026-06-01T20:00:00.000Z",
      },
      {
        id: "stack-1",
        type: "stack",
        url: "https://example.com/stack",
        title: "Stack",
        description: "Stack description",
        tags: [{ id: "workflow", name: "workflow" }],
        submitter: "11111111-1111-4111-8111-111111111111",
        submitterUrl: null,
        parent: null,
        createdAt: "2026-06-01T22:00:00.000Z",
      },
      {
        id: "item-1",
        type: "stack-item",
        url: "https://example.com/item",
        title: "Stack item",
        description: null,
        tags: [],
        submitter: "11111111-1111-4111-8111-111111111111",
        submitterUrl: null,
        parent: {
          id: "stack-1",
          title: "Stack",
        },
        createdAt: "2026-06-02T00:00:00.000Z",
      },
    ]);
  });

  it.each(moderationUpdateCases)(
    "updates a %s item to %s",
    async (type, status, expectedTable, expectedSqlParts) => {
      const mockDb = createExecuteDb([
        { id: "22222222-2222-4222-8222-222222222222", status },
      ]);
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const res = await adminModeration(
        new Request("https://test.com/api/admin/moderation", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer token-1",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: "22222222-2222-4222-8222-222222222222",
            type,
            action: status === "approved" ? "approve" : "reject",
            rejectionCode: status === "rejected" ? "off-topic" : undefined,
            rejectionReason: status === "rejected" ? "Does not fit" : undefined,
          }),
        }),
        createMockContext(),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as ModerationReviewBody;
      expect(body.data).toEqual({
        id: "22222222-2222-4222-8222-222222222222",
        type,
        status,
      });
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      const sqlText = getSqlText(mockDb.execute.mock.calls[0]?.[0]);
      expect(sqlText).toContain(`update ${expectedTable}`);
      expect(sqlText).toContain("and status = 'pending'");
      for (const expectedSqlPart of expectedSqlParts) {
        expect(sqlText).toContain(expectedSqlPart);
      }
    },
  );

  it("returns field-level validation details for invalid review requests", async () => {
    const res = await adminModeration(
      new Request("https://test.com/api/admin/moderation", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "not-a-uuid",
          type: "tool",
          action: "approve",
        }),
      }),
      createMockContext(),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(body.details.id?.[0]).toContain("Invalid UUID");
  });

  it("returns 422 for malformed review JSON", async () => {
    const res = await adminModeration(
      new Request("https://test.com/api/admin/moderation", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: "{",
      }),
      createMockContext(),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(body.error).toBe("Invalid JSON in request body");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns 409 without mutating an already-reviewed item", async () => {
    const mockDb = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ status: "approved" }] }),
    };
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    const res = await adminModeration(
      new Request("https://test.com/api/admin/moderation", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          type: "stack",
          action: "reject",
        }),
      }),
      createMockContext(),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorBody;
    expect(body.error).toBe("Moderation item is already approved");
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
    expect(getSqlText(mockDb.execute.mock.calls[0]?.[0])).toContain(
      "and status = 'pending'",
    );
    expect(getSqlText(mockDb.execute.mock.calls[1]?.[0])).toContain(
      "from public_stacks",
    );
  });

  it("returns 404 when a moderation item does not exist", async () => {
    const mockDb = createExecuteDb([]);
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    const res = await adminModeration(
      new Request("https://test.com/api/admin/moderation", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          type: "tool",
          action: "approve",
        }),
      }),
      createMockContext(),
    );

    expect(res.status).toBe(404);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });
});

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
  details: Record<string, string[]>;
}

type ModerationUpdateCase = readonly [
  type: string,
  status: string,
  expectedSqlParts: readonly string[],
];

const moderationUpdateCases = [
  ["tool", "approved", ["reviewed_by"]],
  ["resource", "approved", ["reviewed_by"]],
  ["stack", "approved", ["reviewed_by"]],
  ["stack-item", "approved", ["reviewed_by"]],
  ["tool", "rejected", ["rejection_code", "rejection_reason"]],
  ["resource", "rejected", ["rejection_code", "rejection_reason"]],
  ["stack", "rejected", ["rejection_code", "rejection_reason"]],
  ["stack-item", "rejected", ["rejection_code", "rejection_reason"]],
] satisfies readonly ModerationUpdateCase[];

function createExecuteDb(rows: unknown[]) {
  return {
    execute: vi.fn().mockResolvedValue({ rows }),
  };
}

function getSqlText(query: unknown): string {
  const queryChunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];

  return queryChunks
    .map((chunk) => {
      if (
        chunk &&
        typeof chunk === "object" &&
        "value" in chunk &&
        Array.isArray(chunk.value)
      ) {
        return chunk.value.join("");
      }

      return "";
    })
    .join("");
}

describe("admin-moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue(adminAuth as never);
  });

  it("returns 401 when the request is not authenticated", async () => {
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue(null);

    const res = await adminModeration(
      new Request("https://test.com/api/admin/moderation"),
      createMockContext(),
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when the user is not an admin", async () => {
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue({
      ...adminAuth,
      isAdmin: false,
    } as never);

    const res = await adminModeration(
      new Request("https://test.com/api/admin/moderation", {
        headers: { Authorization: "Bearer token-1" },
      }),
      createMockContext(),
    );

    expect(res.status).toBe(403);
  });

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
    async (type, status, expectedSqlParts) => {
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
  });
});

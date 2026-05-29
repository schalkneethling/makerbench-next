import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/auth", () => ({
  verifyAuthenticatedUser: vi.fn(),
}));

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

import getLibrary from "../get-library.mts";
import { verifyAuthenticatedUser } from "../lib/auth";
import { getDb } from "../lib/db";
import { createMockContext, createMockDb } from "./test-utils";

interface LibraryBody {
  data: {
    resources: Array<{
      id: string;
      url: string;
      title: string;
      description: string | null;
      notes: string;
      createdAt: string;
      tags: Array<{ id: string; name: string }>;
    }>;
  };
}

describe("get-library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(
      createMockDb() as unknown as ReturnType<typeof getDb>,
    );
  });

  it("returns 401 for guests", async () => {
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue(null);

    const res = await getLibrary(
      new Request("https://test.com/api/library"),
      createMockContext(),
    );

    expect(res.status).toBe(401);
  });

  it("queries and returns rows for the authenticated user", async () => {
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue({
      user: { id: "user-1" },
      isAdmin: false,
    } as never);
    const mockDb = createMockDb();
    mockDb.orderBy.mockResolvedValue([
      {
        id: "bookmark-1",
        url: "https://example.com",
        title: null,
        resourceTitle: "Example",
        description: null,
        resourceDescription: "Description",
        notes: "Private note",
        createdAt: "2026-01-01T00:00:00.000Z",
        tags: ["react"],
      },
    ]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await getLibrary(
      new Request("https://test.com/api/library"),
      createMockContext(),
    );

    expect(res.status).toBe(200);
    expect(mockDb.where).toHaveBeenCalledTimes(1);
    const body = await res.json() as LibraryBody;
    expect(body.data.resources).toEqual([
      {
        id: "bookmark-1",
        url: "https://example.com",
        title: "Example",
        description: "Description",
        notes: "Private note",
        createdAt: "2026-01-01T00:00:00.000Z",
        tags: [{ id: "react", name: "react" }],
      },
    ]);
  });
});

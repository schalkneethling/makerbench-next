import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/auth", () => ({
  verifyAuthenticatedUser: vi.fn(),
}));

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../src/lib/services/metadata", () => ({
  extractMetadata: vi.fn(),
}));

import addLibrary from "../add-library.mts";
import { verifyAuthenticatedUser } from "../lib/auth";
import { getDb } from "../lib/db";
import { extractMetadata } from "../../../src/lib/services/metadata";
import { createMockContext } from "./test-utils";

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };
}

describe("add-library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue({
      user: { id: "user-1" },
      isAdmin: false,
    } as never);
  });

  it("returns duplicate conflicts before extracting metadata", async () => {
    const mockDb = createMockDb();
    mockDb.limit
      .mockResolvedValueOnce([{ id: "resource-1" }])
      .mockResolvedValueOnce([{ id: "bookmark-1" }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await addLibrary(
      new Request("https://test.com/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/resource",
          tags: ["react"],
        }),
      }),
      createMockContext(),
    );

    expect(res.status).toBe(409);
    expect(extractMetadata).not.toHaveBeenCalled();
  });
});

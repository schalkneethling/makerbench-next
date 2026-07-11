import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import authWhoami from "../auth-whoami.mts";
import { getDb } from "../lib/db";
import { createMockContext, createMockDb } from "./test-utils";

interface WhoamiBody {
  data: {
    user: {
      id: string;
      email: string | null;
      displayName: string | null;
      githubUsername: string | null;
      avatarUrl: string | null;
    };
    isAdmin: boolean;
  };
}

describe("auth-whoami", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(createMockDb() as unknown as ReturnType<typeof getDb>);
  });

  it("returns 401 without a bearer token", async () => {
    const res = await authWhoami(
      new Request("https://test.com/api/auth/whoami"),
      createMockContext(),
    );

    expect(res.status).toBe(401);
  });

  it("returns the authenticated identity and admin state", async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([{ role: "admin" }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "test@example.com",
              user_metadata: {
                full_name: "Test User",
                user_name: "test-user",
                avatar_url: "https://example.com/avatar.png",
              },
              app_metadata: { provider: "github" },
            },
          },
          error: null,
        }),
      },
    } as never);

    const res = await authWhoami(
      new Request("https://test.com/api/auth/whoami", {
        headers: { Authorization: "Bearer token-1" },
      }),
      createMockContext(),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as WhoamiBody;
    expect(body.data).toEqual({
      user: {
        id: "user-1",
        email: "test@example.com",
        displayName: "Test User",
        githubUsername: "test-user",
        avatarUrl: "https://example.com/avatar.png",
      },
      isAdmin: true,
    });
  });

  it("does not grant admin for non-admin role rows", async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([{ role: "viewer" }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "test@example.com",
              user_metadata: {},
            },
          },
          error: null,
        }),
      },
    } as never);

    const res = await authWhoami(
      new Request("https://test.com/api/auth/whoami", {
        headers: { Authorization: "Bearer token-1" },
      }),
      createMockContext(),
    );

    const body = (await res.json()) as WhoamiBody;
    expect(body.data.isAdmin).toBe(false);
  });

  it("does not expose a username from a non-GitHub provider", async () => {
    const mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "test@example.com",
              user_metadata: { user_name: "not-github" },
              app_metadata: { provider: "google" },
            },
          },
          error: null,
        }),
      },
    } as never);

    const res = await authWhoami(
      new Request("https://test.com/api/auth/whoami", {
        headers: { Authorization: "Bearer token-1" },
      }),
      createMockContext(),
    );

    const body = (await res.json()) as WhoamiBody;
    expect(body.data.user.githubUsername).toBeNull();
  });
});

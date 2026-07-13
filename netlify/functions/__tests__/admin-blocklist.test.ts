import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth", () => ({
  verifyAuthenticatedUser: vi.fn(),
}));

vi.mock("../lib/submission-blocklist", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/submission-blocklist")>();
  return {
    ...actual,
    createSubmissionBlocklistEntry: vi.fn(),
    deleteSubmissionBlocklistEntry: vi.fn(),
    listSubmissionBlocklistEntries: vi.fn(),
    listSubmissionBlocklistEvents: vi.fn(),
  };
});

import adminBlocklist from "../admin-blocklist.mts";
import { verifyAuthenticatedUser } from "../lib/auth";
import {
  createSubmissionBlocklistEntry,
  deleteSubmissionBlocklistEntry,
  listSubmissionBlocklistEntries,
  listSubmissionBlocklistEvents,
} from "../lib/submission-blocklist";
import { createMockContext } from "./test-utils";

const adminAuth = {
  user: { id: "11111111-1111-4111-8111-111111111111" },
  isAdmin: true,
};
const entry = {
  id: "22222222-2222-4222-8222-222222222222",
  matchType: "domain" as const,
  value: "www.example.com",
  normalizedValue: "example.com",
  createdAt: new Date("2026-07-14T08:00:00.000Z"),
};

function createRequest(method: string, body?: unknown) {
  return new Request("https://test.com/api/admin/blocklist", {
    method,
    headers: {
      Authorization: "Bearer token",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("admin-blocklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue(adminAuth as never);
    vi.mocked(listSubmissionBlocklistEvents).mockResolvedValue([]);
  });

  it.each(["GET", "POST", "DELETE"])(
    "requires authentication for %s requests",
    async (method) => {
      vi.mocked(verifyAuthenticatedUser).mockResolvedValue(null);

      const response = await adminBlocklist(
        createRequest(method),
        createMockContext(),
      );

      expect(response.status).toBe(401);
      expect(listSubmissionBlocklistEntries).not.toHaveBeenCalled();
    },
  );

  it("requires an admin role", async () => {
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue({
      ...adminAuth,
      isAdmin: false,
    } as never);

    const response = await adminBlocklist(
      createRequest("GET"),
      createMockContext(),
    );

    expect(response.status).toBe(403);
  });

  it("lists private blocklist entries", async () => {
    vi.mocked(listSubmissionBlocklistEntries).mockResolvedValue([entry]);

    const response = await adminBlocklist(
      createRequest("GET"),
      createMockContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        entries: [{ normalizedValue: "example.com" }],
        recentEvents: [],
      },
    });
  });

  it("creates a normalized blocklist entry", async () => {
    vi.mocked(createSubmissionBlocklistEntry).mockResolvedValue({
      outcome: "created",
      entry,
    });

    const response = await adminBlocklist(
      createRequest("POST", { matchType: "domain", value: "www.example.com" }),
      createMockContext(),
    );

    expect(response.status).toBe(201);
    expect(createSubmissionBlocklistEntry).toHaveBeenCalledWith(
      { matchType: "domain", value: "www.example.com" },
      adminAuth.user.id,
    );
  });

  it("returns a conflict for duplicate rules", async () => {
    vi.mocked(createSubmissionBlocklistEntry).mockResolvedValue({
      outcome: "duplicate",
    });

    const response = await adminBlocklist(
      createRequest("POST", { matchType: "domain", value: "example.com" }),
      createMockContext(),
    );

    expect(response.status).toBe(409);
  });

  it("rejects malformed domain rules", async () => {
    vi.mocked(createSubmissionBlocklistEntry).mockResolvedValue({
      outcome: "invalid",
    });

    const response = await adminBlocklist(
      createRequest("POST", { matchType: "domain", value: "example.com/path" }),
      createMockContext(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("without a path"),
    });
  });

  it("removes a rule while preserving audit history in the data layer", async () => {
    vi.mocked(deleteSubmissionBlocklistEntry).mockResolvedValue(true);

    const response = await adminBlocklist(
      createRequest("DELETE", { id: entry.id }),
      createMockContext(),
    );

    expect(response.status).toBe(200);
    expect(deleteSubmissionBlocklistEntry).toHaveBeenCalledWith(entry.id);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ErrorResponse, SuccessResponse } from "../lib/responses";

vi.mock("../lib/auth", () => ({
  verifyAuthenticatedUser: vi.fn(),
}));

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../src/lib/services/metadata", () => ({
  extractMetadata: vi.fn(),
}));

vi.mock("../../../src/lib/services/screenshot", () => ({
  captureScreenshot: vi.fn(),
}));

vi.mock("../../../src/lib/services/cloudinary", () => ({
  uploadScreenshot: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

import publicSubmissions from "../public-submissions.mts";
import { verifyAuthenticatedUser } from "../lib/auth";
import { getDb } from "../lib/db";
import { lookup } from "node:dns/promises";
import { captureScreenshot } from "../../../src/lib/services/screenshot";
import { uploadScreenshot } from "../../../src/lib/services/cloudinary";
import { extractMetadata } from "../../../src/lib/services/metadata";
import { createMockContext } from "./test-utils";

interface SubmissionCreated {
  submittedItemId: string;
  type: "tool" | "resource";
  status: "pending";
  message: string;
}

function createMockDb() {
  return {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };
}

function createSubmissionRequest(body: unknown, token?: string): Request {
  return new Request("https://test.com/api/submissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("public-submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);

    vi.mocked(verifyAuthenticatedUser).mockResolvedValue(null);
    vi.mocked(extractMetadata).mockResolvedValue({
      title: "Example title",
      description: "Example description",
      ogImage: null,
    });
    vi.mocked(captureScreenshot).mockResolvedValue({
      success: false,
      buffer: null,
      error: "Skipped in tests",
    });
    vi.mocked(uploadScreenshot).mockResolvedValue({
      success: false,
      url: null,
      publicId: null,
    });
  });

  it("creates an anonymous pending resource listing", async () => {
    const mockDb = createMockDb();
    mockDb.returning
      .mockResolvedValueOnce([{ id: "11111111-1111-4111-8111-111111111111" }])
      .mockResolvedValueOnce([{ id: "22222222-2222-4222-8222-222222222222" }]);
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://example.com/Resource?b=2&a=1#section",
        tags: ["React", " react ", "Testing"],
        submitterName: " Ada ",
        submitterGithubUsername: "ada-lovelace",
      }),
      createMockContext(),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as SuccessResponse<SubmissionCreated>;
    expect(body.data).toMatchObject({
      submittedItemId: "22222222-2222-4222-8222-222222222222",
      type: "resource",
      status: "pending",
    });
    expect(verifyAuthenticatedUser).not.toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        contentKind: "resource",
        submittedByUserId: undefined,
        submitterName: "Ada",
        submitterGithubUrl: "https://github.com/ada-lovelace",
        tags: ["react", "testing"],
      }),
    );
  });

  it("requires anonymous attribution with structured field errors", async () => {
    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://example.com/resource",
        tags: ["css"],
      }),
      createMockContext(),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorResponse;
    expect(body.details).toEqual({
      submitterName: ["Your name is required"],
      submitterGithubUsername: ["GitHub username is required"],
    });
  });

  it("rejects a client-supplied authenticated user object", async () => {
    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://example.com/resource",
        tags: ["css"],
        submitterName: "Ada",
        submitterGithubUsername: "ada",
        authenticatedUser: {
          userId: "00000000-0000-4000-8000-000000000000",
        },
      }),
      createMockContext(),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorResponse;
    expect(body.details?.authenticatedUser).toBeDefined();
  });

  it("stores signed-in attribution for public resource listings", async () => {
    const mockDb = createMockDb();
    mockDb.returning
      .mockResolvedValueOnce([{ id: "33333333-3333-4333-8333-333333333333" }])
      .mockResolvedValueOnce([{ id: "44444444-4444-4444-8444-444444444444" }]);
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue({
      user: {
        id: "55555555-5555-4555-8555-555555555555",
        user_metadata: { full_name: "Verified User" },
        identities: [
          {
            provider: "github",
            identity_data: { user_name: "verified-user" },
          },
        ],
      },
      isAdmin: false,
    } as never);

    const res = await publicSubmissions(
      createSubmissionRequest(
        {
          type: "resource",
          url: "https://example.com/resource",
          tags: ["css"],
        },
        "valid-token",
      ),
      createMockContext(),
    );

    expect(res.status).toBe(201);
    expect(verifyAuthenticatedUser).toHaveBeenCalledOnce();
    expect(mockDb.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        contentKind: "resource",
        submittedByUserId: "55555555-5555-4555-8555-555555555555",
        submitterName: "Verified User",
        submitterGithubUrl: "https://github.com/verified-user",
      }),
    );
  });

  it("requires signed-in users to supply attribution the verified user cannot resolve", async () => {
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue({
      user: {
        id: "55555555-5555-4555-8555-555555555555",
        user_metadata: {},
        identities: [],
      },
      isAdmin: false,
    } as never);

    const res = await publicSubmissions(
      createSubmissionRequest(
        {
          type: "resource",
          url: "https://example.com/resource",
          tags: ["css"],
        },
        "valid-token",
      ),
      createMockContext(),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorResponse;
    expect(body.details).toEqual({
      submitterName: ["Your name is required"],
      submitterGithubUsername: ["GitHub username is required"],
    });
  });

  it("routes tool submissions to tool listings", async () => {
    const mockDb = createMockDb();
    mockDb.returning
      .mockResolvedValueOnce([{ id: "66666666-6666-4666-8666-666666666666" }])
      .mockResolvedValueOnce([{ id: "77777777-7777-4777-8777-777777777777" }]);
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );
    vi.mocked(extractMetadata).mockResolvedValue({
      title: "Tool title",
      description: "Tool description",
      ogImage: "https://example.com/og.png",
    });

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "tool",
        url: "https://example.com/tool",
        tags: ["ai"],
        submitterName: "Ada",
        submitterGithubUsername: "ada",
      }),
      createMockContext(),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as SuccessResponse<SubmissionCreated>;
    expect(body.data.type).toBe("tool");
    expect(captureScreenshot).not.toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pageTitle: "Tool title",
        imageUrl: "https://example.com/og.png",
        imageSource: "og",
      }),
    );
  });

  it("returns structured validation details", async () => {
    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "not-a-url",
        tags: [],
      }),
      createMockContext(),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error).toBe("Validation failed");
    expect(body.details?.url).toBeDefined();
    expect(body.details?.tags).toBeDefined();
  });

  it("rejects article as a separate public submission type", async () => {
    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "article",
        url: "https://example.com/article",
        tags: ["writing"],
      }),
      createMockContext(),
    );

    expect(res.status).toBe(422);
    expect(extractMetadata).not.toHaveBeenCalled();
  });

  it("rejects hostnames that resolve to private addresses before metadata fetch", async () => {
    vi.mocked(lookup).mockResolvedValueOnce([
      { address: "10.0.0.12", family: 4 },
    ] as never);

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://example.com/internal",
        tags: ["security"],
      }),
      createMockContext(),
    );

    expect(res.status).toBe(422);
    expect(extractMetadata).not.toHaveBeenCalled();
  });

  it("returns a clear duplicate conflict", async () => {
    const mockDb = createMockDb();
    mockDb.returning
      .mockResolvedValueOnce([{ id: "88888888-8888-4888-8888-888888888888" }])
      .mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://example.com/resource",
        tags: ["css"],
        submitterName: "Ada",
        submitterGithubUsername: "ada",
      }),
      createMockContext(),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error).toContain("already been submitted");
  });

  it("rejects invalid bearer tokens instead of silently dropping attribution", async () => {
    const res = await publicSubmissions(
      createSubmissionRequest(
        {
          type: "resource",
          url: "https://example.com/resource",
          tags: ["css"],
        },
        "invalid-token",
      ),
      createMockContext(),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error).toBe("Invalid authentication token");
  });
});

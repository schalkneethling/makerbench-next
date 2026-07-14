import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ErrorResponse, SuccessResponse } from "../lib/responses";

vi.mock("../lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth")>();
  return {
    ...actual,
    verifyAuthenticatedUser: vi.fn(),
  };
});

vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../lib/sentry", () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  flushSentry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/submission-blocklist", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/submission-blocklist")>();
  return {
    ...actual,
    findSubmissionBlocklistMatch: vi.fn(),
    recordSubmissionBlocklistEvent: vi.fn(),
  };
});

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
import { captureError, flushSentry } from "../lib/sentry";
import { createSubmissionRateLimitKey } from "../lib/submission-rate-limit";
import {
  findSubmissionBlocklistMatch,
  recordSubmissionBlocklistEvent,
} from "../lib/submission-blocklist";
import { lookup } from "node:dns/promises";
import { captureScreenshot } from "../../../src/lib/services/screenshot";
import { uploadScreenshot } from "../../../src/lib/services/cloudinary";
import { extractMetadata } from "../../../src/lib/services/metadata";
import { TEST_SUBMISSION_RATE_LIMIT_SECRET } from "../../../src/test/rate-limit-fixtures";
import { createMockContext, getPgQuery } from "./test-utils";

const RATE_LIMIT_SECRET = TEST_SUBMISSION_RATE_LIMIT_SECRET;

interface SubmissionCreated {
  submittedItemId: string;
  type: "tool" | "resource";
  status: "pending";
  message: string;
}

function createMockDb() {
  const transactionDb = {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };
  const mockDb = {
    execute: vi.fn().mockResolvedValue({ rows: [{ attempt_count: 1 }] }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    transaction: vi.fn(),
    transactionDb,
  };
  mockDb.transaction.mockImplementation(
    async (
      callback: (transaction: ReturnType<typeof getDb>) => Promise<unknown>,
    ) => await callback(transactionDb as unknown as ReturnType<typeof getDb>),
  );
  return mockDb;
}

function createSubmissionRequest(
  body: unknown,
  token?: string,
  additionalHeaders: Record<string, string> = {},
): Request {
  return new Request("https://test.com/api/submissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...additionalHeaders,
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
    vi.mocked(findSubmissionBlocklistMatch).mockResolvedValue(null);
    vi.mocked(recordSubmissionBlocklistEvent).mockResolvedValue(undefined);
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
    mockDb.transactionDb.returning
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
    expect(mockDb.transactionDb.values).toHaveBeenNthCalledWith(
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

  it("ignores spoofed client IP headers and keys anonymous requests from context.ip", async () => {
    const mockDb = createMockDb();
    mockDb.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_count: 1 }] });
    mockDb.transactionDb.returning
      .mockResolvedValueOnce([{ id: "11111111-1111-4111-8111-111111111111" }])
      .mockResolvedValueOnce([{ id: "22222222-2222-4222-8222-222222222222" }]);
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );
    const context = { ...createMockContext(), ip: "198.51.100.24" };

    const res = await publicSubmissions(
      createSubmissionRequest(
        {
          type: "resource",
          url: "https://example.com/header-spoof-test",
          tags: ["security"],
          submitterName: "Ada",
          submitterGithubUsername: "ada-lovelace",
        },
        undefined,
        {
          "X-Forwarded-For": "203.0.113.99",
          "X-Nf-Client-Connection-Ip": "203.0.113.100",
        },
      ),
      context,
    );

    expect(res.status).toBe(201);
    const admissionQuery = mockDb.execute.mock.calls
      .map(([query]) => getPgQuery(query))
      .find(({ sql }) => sql.includes("INSERT INTO"));
    const contextKey = createSubmissionRateLimitKey(
      { authenticated: null, clientIp: context.ip },
      RATE_LIMIT_SECRET,
    );
    const spoofedKeys = ["203.0.113.99", "203.0.113.100"].map((clientIp) =>
      createSubmissionRateLimitKey(
        { authenticated: null, clientIp },
        RATE_LIMIT_SECRET,
      ),
    );
    expect(admissionQuery?.params).toContain(contextKey);
    for (const spoofedKey of spoofedKeys) {
      expect(admissionQuery?.params).not.toContain(spoofedKey);
    }
  });

  it("stores signed-in attribution for public resource listings", async () => {
    const mockDb = createMockDb();
    mockDb.transactionDb.returning
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
          submitterName: "Spoofed Name",
          submitterGithubUsername: "spoofed-user",
        },
        "valid-token",
      ),
      createMockContext(),
    );

    expect(res.status).toBe(201);
    expect(verifyAuthenticatedUser).toHaveBeenCalledOnce();
    expect(mockDb.transactionDb.values).toHaveBeenNthCalledWith(
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
    mockDb.transactionDb.returning
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
    expect(mockDb.transactionDb.values).toHaveBeenNthCalledWith(
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

  it("fails closed with a generic response for missing or invalid limit configuration", async () => {
    const originalGet = Netlify.env.get;
    const request = createSubmissionRequest({
      type: "resource",
      url: "https://example.com/resource",
      tags: ["css"],
    });

    try {
      Netlify.env.get = vi.fn((key: string) =>
        key === "SUBMISSION_RATE_LIMIT_SECRET" ? undefined : originalGet(key),
      );
      const missingResponse = await publicSubmissions(
        request,
        createMockContext(),
      );
      expect(missingResponse.status).toBe(503);
      await expect(missingResponse.json()).resolves.toEqual({
        success: false,
        error: "Service temporarily unavailable",
      });

      Netlify.env.get = vi.fn((key: string) =>
        key === "SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS"
          ? "zero"
          : originalGet(key),
      );
      const invalidResponse = await publicSubmissions(
        createSubmissionRequest({
          type: "resource",
          url: "https://example.com/other-resource",
          tags: ["css"],
        }),
        createMockContext(),
      );
      expect(invalidResponse.status).toBe(503);
      await expect(invalidResponse.json()).resolves.toEqual({
        success: false,
        error: "Service temporarily unavailable",
      });
    } finally {
      Netlify.env.get = originalGet;
    }
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

  it("rejects a blocklisted URL generically before DNS, metadata, or inserts", async () => {
    const mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );
    vi.mocked(findSubmissionBlocklistMatch).mockResolvedValueOnce({
      id: "11111111-1111-4111-8111-111111111111",
      matchType: "domain",
      normalizedValue: "example.com",
    });

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://www.example.com/blocked",
        tags: ["security"],
      }),
      createMockContext(),
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "This resource cannot be submitted.",
    });
    expect(recordSubmissionBlocklistEvent).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedValue: "example.com" }),
      "https://www.example.com/blocked",
      null,
    );
    expect(lookup).not.toHaveBeenCalled();
    expect(extractMetadata).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("fails closed when the submission blocklist store is unavailable", async () => {
    vi.mocked(findSubmissionBlocklistMatch).mockRejectedValueOnce(
      new Error("blocklist datastore unavailable"),
    );

    try {
      const res = await publicSubmissions(
        createSubmissionRequest({
          type: "resource",
          url: "https://example.com/dependency-error",
          tags: ["security"],
        }),
        createMockContext(),
      );

      expect(res.status).toBe(503);
      await expect(res.json()).resolves.toEqual({
        success: false,
        error: "Service temporarily unavailable",
      });
      expect(captureError).toHaveBeenCalledWith(expect.any(Error), {
        function: "public-submissions",
        dependency: "submission-blocklist-store",
      });
      expect(flushSentry).toHaveBeenCalledOnce();
      expect(extractMetadata).not.toHaveBeenCalled();
    } finally {
      vi.mocked(findSubmissionBlocklistMatch).mockResolvedValue(null);
    }
  });

  it("rejects a pending cross-kind duplicate before metadata work", async () => {
    const mockDb = createMockDb();
    mockDb.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_count: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ status: "pending", submitted_by_user_id: null }],
      });
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://example.com/existing-tool",
        tags: ["css"],
        submitterName: "Ada",
        submitterGithubUsername: "ada",
      }),
      createMockContext(),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "This URL has already been submitted and is awaiting review.",
    });
    const duplicateQuery = getPgQuery(mockDb.execute.mock.calls[2]?.[0]);
    expect(duplicateQuery.sql).toContain("from tool_listings");
    expect(duplicateQuery.sql).toContain("from public_listings");
    expect(extractMetadata).not.toHaveBeenCalled();
    expect(captureScreenshot).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it("returns a published conflict for an approved duplicate", async () => {
    const mockDb = createMockDb();
    mockDb.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_count: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ status: "approved", submitted_by_user_id: null }],
      });
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "tool",
        url: "https://example.com/published",
        tags: ["css"],
        submitterName: "Ada",
        submitterGithubUsername: "ada",
      }),
      createMockContext(),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "This URL is already published.",
    });
    expect(extractMetadata).not.toHaveBeenCalled();
  });

  it("recognizes a signed-in user's pending submission retry", async () => {
    const userId = "55555555-5555-4555-8555-555555555555";
    const mockDb = createMockDb();
    mockDb.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_count: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ status: "pending", submitted_by_user_id: userId }],
      });
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue({
      user: {
        id: userId,
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
          url: "https://example.com/retry",
          tags: ["css"],
        },
        "valid-token",
      ),
      createMockContext(),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "You already submitted this URL. It is awaiting review.",
    });
    expect(extractMetadata).not.toHaveBeenCalled();
  });

  it("locks and rechecks duplicates inside the insert transaction", async () => {
    const mockDb = createMockDb();
    mockDb.transactionDb.returning
      .mockResolvedValueOnce([{ id: "88888888-8888-4888-8888-888888888888" }])
      .mockResolvedValueOnce([{ id: "99999999-9999-4999-8999-999999999999" }]);
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://example.com/transaction",
        tags: ["css"],
        submitterName: "Ada",
        submitterGithubUsername: "ada",
      }),
      createMockContext(),
    );

    expect(res.status).toBe(201);
    expect(mockDb.transaction).toHaveBeenCalledOnce();
    const queries = mockDb.transactionDb.execute.mock.calls.map(([query]) =>
      getPgQuery(query),
    );
    expect(queries).toHaveLength(2);
    expect(queries[0]?.sql).toContain("pg_advisory_xact_lock(hashtextextended");
    expect(queries[1]?.sql).toContain("from tool_listings");
    expect(queries[1]?.sql).toContain("from public_listings");
    expect(mockDb.transactionDb.insert).toHaveBeenCalledTimes(2);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("stops a duplicate detected by the locked transaction recheck", async () => {
    const mockDb = createMockDb();
    mockDb.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_count: 1 }] })
      .mockResolvedValueOnce({ rows: [] });
    mockDb.transactionDb.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ status: "pending", submitted_by_user_id: null }],
      });
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://example.com/concurrent-duplicate",
        tags: ["css"],
        submitterName: "Ada",
        submitterGithubUsername: "ada",
      }),
      createMockContext(),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "This URL has already been submitted and is awaiting review.",
    });
    expect(extractMetadata).toHaveBeenCalledOnce();
    expect(mockDb.transactionDb.insert).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("returns a clear duplicate conflict", async () => {
    const mockDb = createMockDb();
    mockDb.transactionDb.returning
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

  it("rejects throttled requests before metadata or moderation inserts", async () => {
    const mockDb = createMockDb();
    mockDb.execute.mockResolvedValue({ rows: [] });
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://example.com/resource",
        tags: ["css"],
      }),
      createMockContext(),
    );

    expect(res.status).toBe(429);
    const body = (await res.json()) as ErrorResponse;
    expect(body).toEqual({
      success: false,
      error: "Too many submission attempts. Please try again later.",
    });
    expect(body.error).not.toMatch(/5|3600|limit|window/i);
    expect(extractMetadata).not.toHaveBeenCalled();
    expect(captureScreenshot).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("fails closed on limiter datastore errors without logging identity material", async () => {
    const mockDb = createMockDb();
    mockDb.execute.mockRejectedValueOnce(
      new Error("rate limit datastore unavailable"),
    );
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );
    const context = { ...createMockContext(), ip: "198.51.100.25" };

    const res = await publicSubmissions(
      createSubmissionRequest({
        type: "resource",
        url: "https://example.com/dependency-error",
        tags: ["security"],
      }),
      context,
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "Service temporarily unavailable",
    });
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), {
      function: "public-submissions",
      dependency: "submission-rate-limit-store",
    });
    expect(flushSentry).toHaveBeenCalledOnce();
    const captured = JSON.stringify(vi.mocked(captureError).mock.calls);
    expect(captured).not.toContain(context.ip);
    expect(captured).not.toContain(
      createSubmissionRateLimitKey(
        { authenticated: null, clientIp: context.ip },
        RATE_LIMIT_SECRET,
      ),
    );
    expect(extractMetadata).not.toHaveBeenCalled();
    expect(captureScreenshot).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
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

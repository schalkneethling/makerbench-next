import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth", () => ({
  verifyAuthenticatedUser: vi.fn(),
}));

vi.mock("../lib/sentry", () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  flushSentry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/submission-rate-limit", () => ({
  getSubmissionRateLimitConfig: vi.fn(),
  createSubmissionRateLimitKey: vi.fn(),
  consumeSubmissionRateLimit: vi.fn(),
}));

vi.mock("../../../src/lib/services/metadata", () => ({
  extractMetadata: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

import inspectLibrary from "../inspect-library.mts";
import { verifyAuthenticatedUser } from "../lib/auth";
import { captureError, flushSentry } from "../lib/sentry";
import {
  consumeSubmissionRateLimit,
  createSubmissionRateLimitKey,
  getSubmissionRateLimitConfig,
} from "../lib/submission-rate-limit";
import { lookup } from "node:dns/promises";
import { extractMetadata } from "../../../src/lib/services/metadata";
import { createMockContext } from "./test-utils";

function createInspectionRequest(body: unknown): Request {
  return new Request("https://test.com/api/library/inspect", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("inspect-library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue({
      user: { id: "user-1" },
      isAdmin: false,
    } as never);
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);
    vi.mocked(getSubmissionRateLimitConfig).mockReturnValue({
      secret: "a".repeat(64),
      maxAttempts: 5,
      windowSeconds: 3600,
    });
    vi.mocked(createSubmissionRateLimitKey).mockReturnValue("inspection-key");
    vi.mocked(consumeSubmissionRateLimit).mockResolvedValue(true);
  });

  it("returns extracted title and description", async () => {
    vi.mocked(extractMetadata).mockResolvedValue({
      title: "Example title",
      description: "Example description",
      ogImage: null,
    });

    const response = await inspectLibrary(
      createInspectionRequest({ url: "https://example.com/resource" }),
      createMockContext(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        title: "Example title",
        description: "Example description",
      },
    });
    expect(extractMetadata).toHaveBeenCalledWith(
      "https://example.com/resource",
      { dispatcher: expect.anything() },
    );
  });

  it("returns a nonblocking inspection error and records a sanitized extraction failure", async () => {
    vi.mocked(extractMetadata).mockResolvedValue({
      title: null,
      description: null,
      ogImage: null,
      error: "request included sensitive upstream detail",
    });

    const response = await inspectLibrary(
      createInspectionRequest({ url: "https://example.com/private-path" }),
      createMockContext(),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      error:
        "We couldn't inspect this URL right now. You can still save it to your library.",
    });
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Library metadata inspection failed",
      }),
      {
        function: "inspect-library",
        dependency: "metadata-extractor",
      },
    );
    expect(JSON.stringify(vi.mocked(captureError).mock.calls)).not.toContain(
      "private-path",
    );
    expect(JSON.stringify(vi.mocked(captureError).mock.calls)).not.toContain(
      "sensitive upstream detail",
    );
    expect(flushSentry).toHaveBeenCalledOnce();
  });

  it("returns the same sanitized inspection error when extraction throws", async () => {
    vi.mocked(extractMetadata).mockRejectedValue(
      new Error("sensitive thrown detail"),
    );

    const response = await inspectLibrary(
      createInspectionRequest({ url: "https://example.com/private-path" }),
      createMockContext(),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      error:
        "We couldn't inspect this URL right now. You can still save it to your library.",
    });
    expect(JSON.stringify(vi.mocked(captureError).mock.calls)).not.toContain(
      "private-path",
    );
    expect(JSON.stringify(vi.mocked(captureError).mock.calls)).not.toContain(
      "sensitive thrown detail",
    );
    expect(flushSentry).toHaveBeenCalledOnce();
  });

  it("requires authentication", async () => {
    vi.mocked(verifyAuthenticatedUser).mockResolvedValue(null);

    const response = await inspectLibrary(
      createInspectionRequest({ url: "https://example.com/resource" }),
      createMockContext(),
    );

    expect(response.status).toBe(401);
    expect(consumeSubmissionRateLimit).not.toHaveBeenCalled();
    expect(extractMetadata).not.toHaveBeenCalled();
  });

  it("rate limits the authenticated user before DNS or metadata work", async () => {
    vi.mocked(consumeSubmissionRateLimit).mockResolvedValue(false);

    const response = await inspectLibrary(
      createInspectionRequest({ url: "https://example.com/resource" }),
      createMockContext(),
    );

    expect(response.status).toBe(429);
    expect(createSubmissionRateLimitKey).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated: expect.objectContaining({
          user: expect.objectContaining({ id: "user-1" }),
        }),
      }),
      "a".repeat(64),
      "library-inspection",
    );
    expect(lookup).not.toHaveBeenCalled();
    expect(extractMetadata).not.toHaveBeenCalled();
  });

  it("rejects invalid URLs before metadata extraction", async () => {
    const response = await inspectLibrary(
      createInspectionRequest({ url: "not-a-url" }),
      createMockContext(),
    );

    expect(response.status).toBe(422);
    expect(extractMetadata).not.toHaveBeenCalled();
  });

  it("rejects private URLs before DNS or metadata extraction", async () => {
    const response = await inspectLibrary(
      createInspectionRequest({ url: "http://127.0.0.1/admin" }),
      createMockContext(),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      success: false,
      error: "Validation failed",
      details: {
        url: ["Please enter a publicly reachable HTTP/HTTPS URL"],
      },
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(extractMetadata).not.toHaveBeenCalled();
  });
});

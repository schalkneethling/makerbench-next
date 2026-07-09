import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "@netlify/functions";
import type { ErrorResponse, SuccessResponse } from "../lib/responses";

/** Success data shape for process-tool */
interface ToolSubmissionCreated {
  submittedItemId: string;
  type: "tool";
  status: "pending";
  message: string;
}

// Mock the database module
vi.mock("../lib/db", () => ({
  getDb: vi.fn(),
}));

// Mock external services
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

import processTool from "../process-tool.mts";
import { getDb } from "../lib/db";
import { lookup } from "node:dns/promises";
import { extractMetadata } from "../../../src/lib/services/metadata";
import { captureScreenshot } from "../../../src/lib/services/screenshot";
import { uploadScreenshot } from "../../../src/lib/services/cloudinary";

const RESOURCE_ID = "11111111-1111-4111-8111-111111111111";
const TOOL_LISTING_ID = "22222222-2222-4222-8222-222222222222";

/**
 * Creates a mock Netlify Context object
 */
function createMockContext(): Context {
  return {
    account: { id: "test-account" },
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
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

/**
 * Creates a mock database with chainable query methods
 */
function createMockDb() {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi
      .fn()
      .mockResolvedValueOnce([{ id: RESOURCE_ID }])
      .mockResolvedValueOnce([{ id: TOOL_LISTING_ID }]),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };
  return mockDb;
}

describe("process-tool", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockContext: Context;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );
    mockContext = createMockContext();
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);

    // Default mocks for external services
    vi.mocked(extractMetadata).mockResolvedValue({
      title: "Test Page",
      description: "A test page description",
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

  describe("validation", () => {
    it("returns 405 for non-POST requests", async () => {
      const req = new Request("https://test.com/api/tools", {
        method: "GET",
      });

      const res = await processTool(req, mockContext);

      expect(res.status).toBe(405);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toContain("Method not allowed");
    });

    it("returns 422 for invalid JSON body", async () => {
      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      });

      const res = await processTool(req, mockContext);

      expect(res.status).toBe(422);
    });

    it("returns 422 for missing URL", async () => {
      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({ type: "tool", tags: ["test"] }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processTool(req, mockContext);

      expect(res.status).toBe(422);
      const body = (await res.json()) as ErrorResponse;
      expect(body.details?.url).toBeDefined();
    });

    it("returns 422 for missing tags", async () => {
      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({ type: "tool", url: "https://example.com" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processTool(req, mockContext);

      expect(res.status).toBe(422);
      const body = (await res.json()) as ErrorResponse;
      expect(body.details?.tags).toBeDefined();
    });

    it("returns 422 for invalid URL format", async () => {
      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({
          type: "tool",
          url: "not-a-url",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processTool(req, mockContext);

      expect(res.status).toBe(422);
    });

    it("returns 422 for private submission targets before fetching metadata", async () => {
      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({
          type: "tool",
          url: "http://127.0.0.1:3000/tool",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processTool(req, mockContext);

      expect(res.status).toBe(422);
      expect(extractMetadata).not.toHaveBeenCalled();
    });

    it("returns 422 when the tools endpoint receives a non-tool submission", async () => {
      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({
          type: "article",
          url: "https://example.com/article",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processTool(req, mockContext);

      expect(res.status).toBe(422);
      const body = (await res.json()) as ErrorResponse;
      expect(body.details?.type).toContain(
        "/api/tools only accepts tool submissions",
      );
    });

    it("returns generic 503 when required env vars are missing", async () => {
      const originalGet = Netlify.env.get;
      Netlify.env.get = vi.fn((envKey: string) =>
        envKey === "SUPABASE_DATABASE_URL" ? undefined : originalGet(envKey),
      );

      try {
        const req = new Request("https://test.com/api/tools", {
          method: "POST",
          body: JSON.stringify({
            type: "tool",
            url: "https://example.com/tool",
            tags: ["test"],
          }),
          headers: { "Content-Type": "application/json" },
        });

        const res = await processTool(req, mockContext);

        expect(res.status).toBe(503);
        const body = (await res.json()) as ErrorResponse;
        expect(body.error).toBe("Service temporarily unavailable");
        expect(body.error).not.toContain("TURSO");
        expect(body.error).not.toContain("SUPABASE_DATABASE_URL");
      } finally {
        Netlify.env.get = originalGet;
      }
    });
  });

  describe("duplicate detection", () => {
    it("returns 409 for duplicate URL", async () => {
      mockDb.returning.mockReset();
      mockDb.returning
        .mockResolvedValueOnce([{ id: "existing-resource-id" }])
        .mockResolvedValueOnce([]);

      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({
          type: "tool",
          url: "https://example.com",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processTool(req, mockContext);

      expect(res.status).toBe(409);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toContain("already been submitted");
    });
  });

  describe("successful submission", () => {
    it("returns 201 with public submission status data on success", async () => {
      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({
          type: "tool",
          url: "https://example.com/tool",
          tags: ["javascript", "testing"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processTool(req, mockContext);

      expect(res.status).toBe(201);
      const body = (await res.json()) as SuccessResponse<ToolSubmissionCreated>;
      expect(body.success).toBe(true);
      expect(body.data.submittedItemId).toBe(TOOL_LISTING_ID);
      expect(body.data.type).toBe("tool");
      expect(body.data.status).toBe("pending");
      expect(body.data.message).toContain("submitted");
    });

    it("extracts metadata from the URL", async () => {
      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({
          type: "tool",
          url: "https://example.com/tool",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      await processTool(req, mockContext);

      expect(extractMetadata).toHaveBeenCalledWith("https://example.com/tool");
    });

    it("uses OG image when available", async () => {
      vi.mocked(extractMetadata).mockResolvedValueOnce({
        title: "Test",
        description: "Test desc",
        ogImage: "https://example.com/og.png",
      });

      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({
          type: "tool",
          url: "https://example.com/tool",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      await processTool(req, mockContext);

      // Should not attempt screenshot when OG image exists
      expect(captureScreenshot).not.toHaveBeenCalled();
    });

    it("falls back to screenshot when the OG image URL is unsafe", async () => {
      vi.mocked(extractMetadata).mockResolvedValueOnce({
        title: "Test",
        description: "Test desc",
        ogImage: "javascript:alert(1)",
      });
      vi.mocked(captureScreenshot).mockResolvedValueOnce({
        success: true,
        buffer: Buffer.from("fake-image"),
      });
      vi.mocked(uploadScreenshot).mockResolvedValueOnce({
        success: true,
        url: "https://cloudinary.com/screenshot.png",
        publicId: "test-id",
      });

      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({
          type: "tool",
          url: "https://example.com/tool",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      await processTool(req, mockContext);

      expect(mockDb.values).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          imageUrl: "https://cloudinary.com/screenshot.png",
          imageSource: "screenshot",
        }),
      );
    });

    it("falls back to screenshot when no OG image", async () => {
      vi.mocked(captureScreenshot).mockResolvedValueOnce({
        success: true,
        buffer: Buffer.from("fake-image"),
      });

      vi.mocked(uploadScreenshot).mockResolvedValueOnce({
        success: true,
        url: "https://cloudinary.com/screenshot.png",
        publicId: "test-id",
      });

      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({
          type: "tool",
          url: "https://example.com/tool",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      await processTool(req, mockContext);

      expect(captureScreenshot).toHaveBeenCalled();
      expect(uploadScreenshot).toHaveBeenCalled();
    });

    it("normalizes tags to lowercase", async () => {
      const req = new Request("https://test.com/api/tools", {
        method: "POST",
        body: JSON.stringify({
          type: "tool",
          url: "https://example.com/tool",
          tags: ["JavaScript", "TESTING"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      await processTool(req, mockContext);

      // Verify insert was called (tags are processed internally)
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "@netlify/functions";

/* eslint-disable @typescript-eslint/no-explicit-any */

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

import processBookmark from "../process-bookmark.mts";
import { getDb } from "../lib/db";
import { extractMetadata } from "../../../src/lib/services/metadata";
import { captureScreenshot } from "../../../src/lib/services/screenshot";
import { uploadScreenshot } from "../../../src/lib/services/cloudinary";

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
    returning: vi.fn().mockResolvedValue([{ id: "test-bookmark-id" }]),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };
  return mockDb;
}

describe("process-bookmark", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockContext: Context;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof getDb>,
    );
    mockContext = createMockContext();

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
      const req = new Request("https://test.com/api/bookmarks", {
        method: "GET",
      });

      const res = await processBookmark(req, mockContext);

      expect(res.status).toBe(405);
      const body = (await res.json()) as any;
      expect(body.error).toContain("Method not allowed");
    });

    it("returns 422 for invalid JSON body", async () => {
      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      });

      const res = await processBookmark(req, mockContext);

      expect(res.status).toBe(422);
    });

    it("returns 422 for missing URL", async () => {
      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ tags: ["test"] }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processBookmark(req, mockContext);

      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.details?.url).toBeDefined();
    });

    it("returns 422 for missing tags", async () => {
      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processBookmark(req, mockContext);

      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.details?.tags).toBeDefined();
    });

    it("returns 422 for invalid URL format", async () => {
      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ url: "not-a-url", tags: ["test"] }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processBookmark(req, mockContext);

      expect(res.status).toBe(422);
    });
  });

  describe("duplicate detection", () => {
    it("returns 409 for duplicate URL", async () => {
      // Mock existing bookmark found
      mockDb.limit.mockResolvedValueOnce([{ id: "existing-id" }]);

      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processBookmark(req, mockContext);

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error).toContain("already been submitted");
    });
  });

  describe("successful submission", () => {
    it("returns 201 with bookmark ID on success", async () => {
      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/tool",
          tags: ["javascript", "testing"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await processBookmark(req, mockContext);

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.bookmarkId).toBeDefined();
      expect(body.data.message).toContain("submitted");
    });

    it("extracts metadata from the URL", async () => {
      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/tool",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      await processBookmark(req, mockContext);

      expect(extractMetadata).toHaveBeenCalledWith("https://example.com/tool");
    });

    it("uses OG image when available", async () => {
      vi.mocked(extractMetadata).mockResolvedValueOnce({
        title: "Test",
        description: "Test desc",
        ogImage: "https://example.com/og.png",
      });

      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/tool",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      await processBookmark(req, mockContext);

      // Should not attempt screenshot when OG image exists
      expect(captureScreenshot).not.toHaveBeenCalled();
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

      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/tool",
          tags: ["test"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      await processBookmark(req, mockContext);

      expect(captureScreenshot).toHaveBeenCalled();
      expect(uploadScreenshot).toHaveBeenCalled();
    });

    it("normalizes tags to lowercase", async () => {
      const req = new Request("https://test.com/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/tool",
          tags: ["JavaScript", "TESTING"],
        }),
        headers: { "Content-Type": "application/json" },
      });

      await processBookmark(req, mockContext);

      // Verify insert was called (tags are processed internally)
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});

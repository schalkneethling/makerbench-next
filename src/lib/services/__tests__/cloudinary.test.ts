import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadScreenshot } from "../cloudinary";

// Mock cloudinary SDK
vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload_stream: vi.fn(),
    },
  },
}));

import { v2 as cloudinary } from "cloudinary";

describe("uploadScreenshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads buffer and returns Cloudinary URL", async () => {
    const mockUploadStream = vi.fn((_options, callback) => {
      // Simulate successful upload
      setTimeout(() => {
        callback(null, {
          secure_url: "https://res.cloudinary.com/test/image/upload/v123/screenshot.png",
          public_id: "screenshots/2024/12/test-id",
        });
      }, 0);

      // Return mock stream
      return {
        end: vi.fn(),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as any);

    const buffer = Buffer.from("fake-png-data");
    const result = await uploadScreenshot(buffer, "test-bookmark-id");

    expect(result.success).toBe(true);
    expect(result.url).toContain("cloudinary.com");
    expect(result.publicId).toBeDefined();
  });

  it("returns error when upload fails", async () => {
    const mockUploadStream = vi.fn((_options, callback) => {
      setTimeout(() => {
        callback(new Error("Upload failed: rate limit"), null);
      }, 0);

      return {
        end: vi.fn(),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as any);

    const buffer = Buffer.from("fake-png-data");
    const result = await uploadScreenshot(buffer, "test-id");

    expect(result.success).toBe(false);
    expect(result.url).toBeNull();
    expect(result.error).toContain("Upload failed");
  });

  it("uses correct folder structure for organization", async () => {
    let capturedOptions: Record<string, unknown> = {};

    const mockUploadStream = vi.fn((options, callback) => {
      capturedOptions = options as Record<string, unknown>;
      setTimeout(() => {
        callback(null, {
          secure_url: "https://res.cloudinary.com/test/image.png",
          public_id: "test",
        });
      }, 0);

      return {
        end: vi.fn(),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as any);

    const buffer = Buffer.from("fake-png-data");
    await uploadScreenshot(buffer, "my-bookmark");

    expect(capturedOptions.folder).toMatch(/^screenshots\/\d{4}\/\d{2}$/);
    expect(capturedOptions.public_id).toBe("my-bookmark");
    expect(capturedOptions.resource_type).toBe("image");
  });
});


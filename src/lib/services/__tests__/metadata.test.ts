import { describe, it, expect } from "vitest";
import { extractMetadata } from "../metadata";

describe("extractMetadata", () => {
  it("extracts title, description, and OG image from page with full metadata", async () => {
    const result = await extractMetadata("https://example.com/with-og");

    expect(result.title).toBe("Example Tool - OG Title");
    expect(result.description).toBe("OG description for the tool");
    expect(result.ogImage).toBe("https://example.com/og-image.png");
  });

  it("falls back to regular title when no OG title exists", async () => {
    const result = await extractMetadata("https://example.com/no-og-image");

    expect(result.title).toBe("Tool Without OG Image");
    expect(result.description).toBe("This tool has no OG image");
    expect(result.ogImage).toBeNull();
  });

  it("handles pages with minimal metadata", async () => {
    const result = await extractMetadata("https://example.com/minimal");

    expect(result.title).toBe("Minimal Page");
    expect(result.description).toBeNull();
    expect(result.ogImage).toBeNull();
  });

  it("returns fallback values when page is unreachable", async () => {
    const result = await extractMetadata("https://unreachable.invalid/page");

    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
    expect(result.ogImage).toBeNull();
    expect(result.error).toBeDefined();
  });
});


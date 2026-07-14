import { afterEach, describe, expect, it, vi } from "vitest";

import { inspectLibraryResource } from "../library";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("inspectLibraryResource", () => {
  it("sends the authenticated URL and validates the inspected metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            title: "Inspected title",
            description: "Inspected description",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await inspectLibraryResource(
      "https://example.com/resource",
      "verified-token",
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/library/inspect", {
      method: "POST",
      headers: {
        Authorization: "Bearer verified-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com/resource" }),
    });
    expect(result).toEqual({
      title: "Inspected title",
      description: "Inspected description",
    });
  });

  it("throws a typed error when inspection fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: "The page did not expose usable metadata.",
          }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      inspectLibraryResource("https://example.com/resource", "verified-token"),
    ).rejects.toMatchObject({
      name: "BookmarkApiError",
      status: 422,
      message: "The page did not expose usable metadata.",
    });
  });

  it("lets unexpected fetch failures propagate to the hook", async () => {
    const networkError = new TypeError("network unavailable");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));

    await expect(
      inspectLibraryResource("https://example.com/resource", "verified-token"),
    ).rejects.toBe(networkError);
  });
});

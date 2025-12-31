import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import { useSubmitBookmark } from "../useSubmitBookmark";
import { BookmarkApiError } from "../../api";

function createSubmitHandler() {
  return http.post("/api/bookmarks", async ({ request }) => {
    const body = (await request.json()) as { url?: string; tags?: string[] };

    if (!body.url) {
      return HttpResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: { url: ["URL is required"] },
        },
        { status: 422 },
      );
    }

    if (body.url === "https://example.com/duplicate") {
      return HttpResponse.json(
        {
          success: false,
          error: "This URL has already been submitted",
        },
        { status: 409 },
      );
    }

    return HttpResponse.json(
      {
        success: true,
        data: {
          bookmarkId: "new-bookmark-id",
          message: "Bookmark submitted successfully",
        },
      },
      { status: 201 },
    );
  });
}

beforeEach(() => {
  server.use(createSubmitHandler());
});

afterEach(() => {
  server.resetHandlers();
});

describe("useSubmitBookmark", () => {
  it("starts with initial state", () => {
    const { result } = renderHook(() => useSubmitBookmark());

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.response).toBeNull();
  });

  it("submits a bookmark successfully", async () => {
    const { result } = renderHook(() => useSubmitBookmark());

    let submitResult!: Awaited<ReturnType<typeof result.current.submit>>;

    await act(async () => {
      submitResult = await result.current.submit({
        url: "https://example.com/new-tool",
        tags: ["typescript"],
      });
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.response?.bookmarkId).toBe("new-bookmark-id");
    expect(result.current.response?.message).toContain("successfully");
    expect(submitResult?.bookmarkId).toBe("new-bookmark-id");
  });

  it("sets isSubmitting during request", async () => {
    const { result } = renderHook(() => useSubmitBookmark());

    // Don't await - check state during request
    act(() => {
      result.current.submit({
        url: "https://example.com/tool",
        tags: ["test"],
      });
    });

    expect(result.current.isSubmitting).toBe(true);

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  it("handles validation errors", async () => {
    const { result } = renderHook(() => useSubmitBookmark());

    let submitResult!: Awaited<ReturnType<typeof result.current.submit>>;

    await act(async () => {
      submitResult = await result.current.submit({
        url: "",
        tags: ["test"],
      });
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeInstanceOf(BookmarkApiError);
    expect(result.current.error?.status).toBe(422);
    expect(result.current.error?.details?.url).toContain("URL is required");
    expect(result.current.response).toBeNull();
    expect(submitResult).toBeNull();
  });

  it("handles duplicate URL error", async () => {
    const { result } = renderHook(() => useSubmitBookmark());

    await act(async () => {
      await result.current.submit({
        url: "https://example.com/duplicate",
        tags: ["test"],
      });
    });

    expect(result.current.error).toBeInstanceOf(BookmarkApiError);
    expect(result.current.error?.status).toBe(409);
    expect(result.current.error?.message).toContain("already been submitted");
  });

  it("clears previous error on new submit", async () => {
    const { result } = renderHook(() => useSubmitBookmark());

    // First submit - fails
    await act(async () => {
      await result.current.submit({
        url: "",
        tags: ["test"],
      });
    });

    expect(result.current.error).not.toBeNull();

    // Second submit - succeeds
    await act(async () => {
      await result.current.submit({
        url: "https://example.com/valid",
        tags: ["test"],
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.response).not.toBeNull();
  });

  it("resets state", async () => {
    const { result } = renderHook(() => useSubmitBookmark());

    await act(async () => {
      await result.current.submit({
        url: "https://example.com/tool",
        tags: ["test"],
      });
    });

    expect(result.current.response).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.response).toBeNull();
  });
});

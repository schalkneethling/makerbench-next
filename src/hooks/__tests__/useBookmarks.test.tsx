import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import { useBookmarks } from "../useBookmarks";
import { BookmarkApiError } from "../../api";

const mockBookmarks = [
  {
    id: "b1",
    url: "https://example.com/tool-1",
    title: "Tool One",
    description: "A great tool",
    imageUrl: "https://example.com/image1.png",
    createdAt: "2024-01-15T10:00:00Z",
    tags: [{ id: "t1", name: "javascript" }],
  },
  {
    id: "b2",
    url: "https://example.com/tool-2",
    title: "Tool Two",
    description: null,
    imageUrl: null,
    createdAt: "2024-01-14T10:00:00Z",
    tags: [{ id: "t2", name: "react" }],
  },
];

function createGetBookmarksHandler() {
  return http.get("/api/bookmarks", ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const paginatedBookmarks = mockBookmarks.slice(offset, offset + limit);

    return HttpResponse.json({
      success: true,
      data: {
        bookmarks: paginatedBookmarks,
        pagination: {
          total: mockBookmarks.length,
          limit,
          offset,
          hasMore: offset + paginatedBookmarks.length < mockBookmarks.length,
        },
      },
    });
  });
}

beforeEach(() => {
  server.use(createGetBookmarksHandler());
});

afterEach(() => {
  server.resetHandlers();
});

describe("useBookmarks", () => {
  it("fetches bookmarks on mount", async () => {
    const { result } = renderHook(() => useBookmarks());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.bookmarks).toHaveLength(2);
    expect(result.current.bookmarks[0].title).toBe("Tool One");
    expect(result.current.error).toBeNull();
  });

  it("respects initial params", async () => {
    const { result } = renderHook(() => useBookmarks({ limit: 1 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.bookmarks).toHaveLength(1);
    expect(result.current.pagination?.limit).toBe(1);
  });

  it("handles fetch errors", async () => {
    server.use(
      http.get("/api/bookmarks", () => {
        return HttpResponse.json(
          { success: false, error: "Database error" },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useBookmarks());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(BookmarkApiError);
    expect(result.current.error?.message).toBe("Database error");
    expect(result.current.bookmarks).toHaveLength(0);
  });

  it("can manually refetch", async () => {
    const { result } = renderHook(() => useBookmarks());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.fetch({ limit: 1 });
    });

    expect(result.current.bookmarks).toHaveLength(1);
  });

  it("loads more bookmarks", async () => {
    // Set up handler that returns hasMore: true for first page
    server.use(
      http.get("/api/bookmarks", ({ request }) => {
        const url = new URL(request.url);
        const offset = parseInt(url.searchParams.get("offset") || "0");

        if (offset === 0) {
          return HttpResponse.json({
            success: true,
            data: {
              bookmarks: [mockBookmarks[0]],
              pagination: { total: 2, limit: 1, offset: 0, hasMore: true },
            },
          });
        }

        return HttpResponse.json({
          success: true,
          data: {
            bookmarks: [mockBookmarks[1]],
            pagination: { total: 2, limit: 1, offset: 1, hasMore: false },
          },
        });
      }),
    );

    const { result } = renderHook(() => useBookmarks({ limit: 1 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.bookmarks).toHaveLength(1);
    expect(result.current.pagination?.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.bookmarks).toHaveLength(2);
    expect(result.current.pagination?.hasMore).toBe(false);
  });

  it("does not load more when hasMore is false", async () => {
    const fetchSpy = vi.fn();
    server.use(
      http.get("/api/bookmarks", () => {
        fetchSpy();
        return HttpResponse.json({
          success: true,
          data: {
            bookmarks: mockBookmarks,
            pagination: { total: 2, limit: 20, offset: 0, hasMore: false },
          },
        });
      }),
    );

    const { result } = renderHook(() => useBookmarks());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Reset spy count after initial fetch
    fetchSpy.mockClear();

    await act(async () => {
      await result.current.loadMore();
    });

    // Should not have made another request
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resets state", async () => {
    const { result } = renderHook(() => useBookmarks());

    await waitFor(() => {
      expect(result.current.bookmarks).toHaveLength(2);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.bookmarks).toHaveLength(0);
    expect(result.current.pagination).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

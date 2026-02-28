import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import { useSearch } from "../useSearch";
import { BookmarkApiError } from "../../api";

const mockBookmarks = [
  {
    id: "b1",
    url: "https://example.com/tool-1",
    title: "Tool One",
    description: "A great tool",
    imageUrl: null,
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

function createSearchHandler() {
  return http.get("/api/bookmarks/search", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase() || "";
    const tagsParam = url.searchParams.get("tags") || "";
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const tagFilters = tagsParam
      .split(",")
      .filter((t) => t.length > 0)
      .map((t) => t.toLowerCase());

    let filtered = [...mockBookmarks];

    if (q) {
      filtered = filtered.filter((b) => b.title?.toLowerCase().includes(q));
    }

    if (tagFilters.length > 0) {
      filtered = filtered.filter((b) =>
        b.tags.some((tag) => tagFilters.includes(tag.name.toLowerCase())),
      );
    }

    const paginatedResults = filtered.slice(offset, offset + limit);

    return HttpResponse.json({
      success: true,
      data: {
        bookmarks: paginatedResults,
        pagination: {
          total: filtered.length,
          limit,
          offset,
          hasMore: offset + paginatedResults.length < filtered.length,
        },
      },
    });
  });
}

beforeEach(() => {
  server.use(createSearchHandler());
});

afterEach(() => {
  server.resetHandlers();
});

describe("useSearch", () => {
  it("starts with empty state", () => {
    const { result } = renderHook(() => useSearch(0));

    expect(result.current.results).toHaveLength(0);
    expect(result.current.pagination).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("searches by query", async () => {
    const { result } = renderHook(() => useSearch(0));

    act(() => {
      result.current.search({ q: "one" });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].title).toBe("Tool One");
  });

  it("searches by tags", async () => {
    const { result } = renderHook(() => useSearch(0));

    act(() => {
      result.current.search({ tags: ["react"] });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].id).toBe("b2");
  });

  it("debounces search requests", async () => {
    // Use real debounce with short delay
    const searchSpy = vi.fn();
    server.use(
      http.get("/api/bookmarks/search", () => {
        searchSpy();
        return HttpResponse.json({
          success: true,
          data: {
            bookmarks: [],
            pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
          },
        });
      }),
    );

    const { result } = renderHook(() => useSearch(50));

    // Rapid fire searches - all within debounce window
    act(() => {
      result.current.search({ q: "a" });
    });
    act(() => {
      result.current.search({ q: "ab" });
    });
    act(() => {
      result.current.search({ q: "abc" });
    });

    // Wait for debounce and completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should only have made one request (the last one)
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

  it("handles search errors", async () => {
    server.use(
      http.get("/api/bookmarks/search", () => {
        return HttpResponse.json(
          { success: false, error: "Search failed" },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useSearch(0));

    act(() => {
      result.current.search({ q: "test" });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(BookmarkApiError);
    expect(result.current.error?.message).toBe("Search failed");
  });

  it("loads more search results", async () => {
    server.use(
      http.get("/api/bookmarks/search", ({ request }) => {
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

    const { result } = renderHook(() => useSearch(0));

    act(() => {
      result.current.search({ q: "tool", limit: 1 });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.results).toHaveLength(1);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.results).toHaveLength(2);
  });

  it("resets state", async () => {
    const { result } = renderHook(() => useSearch(0));

    act(() => {
      result.current.search({ q: "tool" });
    });

    await waitFor(() => {
      expect(result.current.results.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.results).toHaveLength(0);
    expect(result.current.pagination).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

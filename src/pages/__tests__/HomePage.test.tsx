import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomePage } from "../HomePage";
import { useBookmarks, useSearch, useTags } from "../../hooks";

vi.mock("../../hooks", () => ({
  useBookmarks: vi.fn(),
  useSearch: vi.fn(),
  useTags: vi.fn(),
}));

function LocationDisplay() {
  const location = useLocation();

  return <div data-testid="location">{location.search}</div>;
}

const mockBookmark = {
  id: "b1",
  title: "Tool One",
  description: "A great tool",
  imageUrl: null,
  submitterName: null,
  submitterGithubUrl: null,
  url: "https://example.com/tool-1",
  createdAt: "2024-01-15T10:00:00Z",
  tags: [{ id: "t1", name: "javascript" }],
};

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useBookmarks).mockReturnValue({
      bookmarks: [mockBookmark],
      pagination: { total: null, limit: 20, offset: 0, hasMore: false },
      isLoading: false,
      error: null,
      fetch: vi.fn(),
      loadMore: vi.fn(),
      reset: vi.fn(),
    });

    vi.mocked(useSearch).mockReturnValue({
      results: [],
      pagination: null,
      isLoading: false,
      error: null,
      search: vi.fn(),
      loadMore: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("defers tag loading until the idle callback runs", () => {
    let idleCallback: IdleRequestCallback | undefined;
    const requestIdleCallbackMock = vi.fn((callback: IdleRequestCallback) => {
      idleCallback = callback;
      return 1;
    });

    vi.stubGlobal("requestIdleCallback", requestIdleCallbackMock);
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    vi.mocked(useTags).mockImplementation(({ enabled = true, limit } = {}) => {
      if (!enabled) {
        return { tags: [], isLoading: false, error: null };
      }

      expect(limit).toBe(10);

      return {
        tags: [{ id: "t1", name: "javascript", usageCount: 3 }],
        isLoading: false,
        error: null,
      };
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "javascript" })).not.toBeInTheDocument();
    expect(requestIdleCallbackMock).toHaveBeenCalledOnce();

    act(() => {
      idleCallback?.({
        didTimeout: false,
        timeRemaining: () => 50,
      });
    });

    expect(screen.getByRole("button", { name: "javascript" })).toBeInTheDocument();
    expect(vi.mocked(useTags)).toHaveBeenLastCalledWith({
      enabled: true,
      limit: 10,
    });
  });

  it("loads tags after the timeout fallback and keeps tag filtering wired up", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);

    const searchMock = vi.fn();
    vi.mocked(useSearch).mockReturnValue({
      results: [],
      pagination: null,
      isLoading: false,
      error: null,
      search: searchMock,
      loadMore: vi.fn(),
      reset: vi.fn(),
    });

    vi.mocked(useTags).mockImplementation(({ enabled = true } = {}) => ({
      tags: enabled
        ? [{ id: "t1", name: "javascript", usageCount: 3 }]
        : [],
      isLoading: false,
      error: null,
    }));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <MemoryRouter>
        <HomePage />
        <LocationDisplay />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "javascript" })).not.toBeInTheDocument();

    act(() => {
      vi.runAllTimers();
    });

    await user.click(screen.getByRole("button", { name: "javascript" }));

    expect(searchMock).toHaveBeenCalledWith(
      { q: undefined, tags: ["javascript"] },
      { immediate: true },
    );
    expect(screen.getByTestId("location")).toHaveTextContent("?tags=javascript&mode=filter");

    vi.useRealTimers();
  });
});

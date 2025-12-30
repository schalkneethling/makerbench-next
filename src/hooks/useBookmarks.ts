import { useState, useEffect, useCallback } from "react";

import {
  getBookmarks,
  type Bookmark,
  type PaginationInfo,
  type GetBookmarksParams,
  BookmarkApiError,
} from "../api";

interface UseBookmarksState {
  bookmarks: Bookmark[];
  pagination: PaginationInfo | null;
  isLoading: boolean;
  error: BookmarkApiError | null;
}

interface UseBookmarksReturn extends UseBookmarksState {
  /** Fetch bookmarks (replaces current list) */
  fetch: (params?: GetBookmarksParams) => Promise<void>;
  /** Load more bookmarks (appends to current list) */
  loadMore: () => Promise<void>;
  /** Reset to initial state */
  reset: () => void;
}

/**
 * Hook for fetching paginated bookmarks
 */
export function useBookmarks(
  initialParams?: GetBookmarksParams,
): UseBookmarksReturn {
  const [state, setState] = useState<UseBookmarksState>({
    bookmarks: [],
    pagination: null,
    isLoading: false,
    error: null,
  });

  const fetch = useCallback(async (params?: GetBookmarksParams) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await getBookmarks(params);
      setState({
        bookmarks: data.bookmarks,
        pagination: data.pagination,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const error =
        err instanceof BookmarkApiError
          ? err
          : new BookmarkApiError("Failed to fetch bookmarks", 500);
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!state.pagination?.hasMore || state.isLoading) {
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const newOffset = state.pagination.offset + state.pagination.limit;
      const data = await getBookmarks({
        limit: state.pagination.limit,
        offset: newOffset,
      });

      setState((prev) => ({
        bookmarks: [...prev.bookmarks, ...data.bookmarks],
        pagination: data.pagination,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      const error =
        err instanceof BookmarkApiError
          ? err
          : new BookmarkApiError("Failed to load more bookmarks", 500);
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, [state.pagination, state.isLoading]);

  const reset = useCallback(() => {
    setState({
      bookmarks: [],
      pagination: null,
      isLoading: false,
      error: null,
    });
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetch(initialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    fetch,
    loadMore,
    reset,
  };
}


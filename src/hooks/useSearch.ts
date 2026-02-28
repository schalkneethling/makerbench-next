import { useState, useEffect, useCallback, useRef } from "react";

import {
  searchBookmarks,
  type Bookmark,
  type PaginationInfo,
  type SearchBookmarksParams,
  BookmarkApiError,
} from "../api";

interface UseSearchState {
  results: Bookmark[];
  pagination: PaginationInfo | null;
  isLoading: boolean;
  error: BookmarkApiError | null;
}

interface UseSearchReturn extends UseSearchState {
  /** Execute search with params */
  search: (params: SearchBookmarksParams) => Promise<void>;
  /** Load more search results */
  loadMore: () => Promise<void>;
  /** Reset to initial state */
  reset: () => void;
}

const DEBOUNCE_MS = 300;

/**
 * Hook for searching bookmarks with debouncing
 */
export function useSearch(debounceMs = DEBOUNCE_MS): UseSearchReturn {
  const [state, setState] = useState<UseSearchState>({
    results: [],
    pagination: null,
    isLoading: false,
    error: null,
  });

  const [searchParams, setSearchParams] = useState<SearchBookmarksParams | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = useCallback(async (params: SearchBookmarksParams) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await searchBookmarks(params);
      setState({
        results: data.bookmarks,
        pagination: data.pagination,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const error =
        err instanceof BookmarkApiError
          ? err
          : new BookmarkApiError("Search failed", 500);
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, []);

  const search = useCallback(
    async (params: SearchBookmarksParams) => {
      // Store params for loadMore
      setSearchParams(params);

      // Clear any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Set loading immediately for UI feedback
      setState((prev) => ({ ...prev, isLoading: true }));

      // Debounce the actual search
      debounceRef.current = setTimeout(() => {
        executeSearch(params);
      }, debounceMs);
    },
    [debounceMs, executeSearch],
  );

  const loadMore = useCallback(async () => {
    if (!state.pagination?.hasMore || state.isLoading || !searchParams) {
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const newOffset = state.pagination.offset + state.pagination.limit;
      const data = await searchBookmarks({
        ...searchParams,
        offset: newOffset,
      });

      setState((prev) => ({
        results: [...prev.results, ...data.bookmarks],
        pagination: data.pagination,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      const error =
        err instanceof BookmarkApiError
          ? err
          : new BookmarkApiError("Failed to load more results", 500);
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, [state.pagination, state.isLoading, searchParams]);

  const reset = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setSearchParams(null);
    setState({
      results: [],
      pagination: null,
      isLoading: false,
      error: null,
    });
  }, []);

  // Clear any pending debounced search when component unmounts
  // Note: Active timeouts are already cleared in search() and reset(),
  // this is a safety cleanup for edge cases (e.g., unmount during debounce delay)
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    ...state,
    search,
    loadMore,
    reset,
  };
}


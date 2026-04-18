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
  search: (
    params: SearchBookmarksParams,
    options?: { immediate?: boolean },
  ) => Promise<void>;
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
  const abortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);

  const cancelActiveRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const executeSearch = useCallback(async (
    params: SearchBookmarksParams,
    requestId: number,
    signal: AbortSignal,
  ) => {
    const startedAt =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();

    try {
      const data = await searchBookmarks(params, { signal });

      if (signal.aborted || requestId !== activeRequestIdRef.current) {
        return;
      }

      const durationMs = Math.round(
        (typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now()) - startedAt,
      );

      console.info("[perf] home-search", {
        requestId,
        durationMs,
        resultCount: data.bookmarks.length,
        hasMore: data.pagination.hasMore,
      });

      setState({
        results: data.bookmarks,
        pagination: data.pagination,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      if (signal.aborted || requestId !== activeRequestIdRef.current) {
        return;
      }

      const error =
        err instanceof BookmarkApiError
          ? err
          : new BookmarkApiError("Search failed", 500);
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, []);

  const search = useCallback(
    async (
      params: SearchBookmarksParams,
      options: { immediate?: boolean } = {},
    ) => {
      // Store params for loadMore
      setSearchParams(params);

      // Clear any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      cancelActiveRequest();
      const controller = new AbortController();
      abortRef.current = controller;
      activeRequestIdRef.current += 1;
      const requestId = activeRequestIdRef.current;

      // Set loading immediately for UI feedback
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      if (options.immediate) {
        await executeSearch(params, requestId, controller.signal);
        return;
      }

      // Debounce the actual search
      debounceRef.current = setTimeout(() => {
        executeSearch(params, requestId, controller.signal);
      }, debounceMs);
    },
    [cancelActiveRequest, debounceMs, executeSearch],
  );

  const loadMore = useCallback(async () => {
    if (!state.pagination?.hasMore || state.isLoading || !searchParams) {
      return;
    }

    cancelActiveRequest();
    const controller = new AbortController();
    abortRef.current = controller;
    activeRequestIdRef.current += 1;
    const requestId = activeRequestIdRef.current;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const newOffset = state.pagination.offset + state.pagination.limit;
      const data = await searchBookmarks({
        ...searchParams,
        offset: newOffset,
      }, {
        signal: controller.signal,
      });

      if (controller.signal.aborted || requestId !== activeRequestIdRef.current) {
        return;
      }

      setState((prev) => ({
        results: [...prev.results, ...data.bookmarks],
        pagination: data.pagination,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      if (controller.signal.aborted || requestId !== activeRequestIdRef.current) {
        return;
      }

      const error =
        err instanceof BookmarkApiError
          ? err
          : new BookmarkApiError("Failed to load more results", 500);
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, [cancelActiveRequest, state.pagination, state.isLoading, searchParams]);

  const reset = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    cancelActiveRequest();
    setSearchParams(null);
    setState({
      results: [],
      pagination: null,
      isLoading: false,
      error: null,
    });
  }, [cancelActiveRequest]);

  // Clear any pending debounced search when component unmounts
  // Note: Active timeouts are already cleared in search() and reset(),
  // this is a safety cleanup for edge cases (e.g., unmount during debounce delay)
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      cancelActiveRequest();
    };
  }, [cancelActiveRequest]);

  return {
    ...state,
    search,
    loadMore,
    reset,
  };
}

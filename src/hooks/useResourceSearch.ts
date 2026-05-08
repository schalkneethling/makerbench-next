import { useCallback, useEffect, useRef, useState } from "react";

import {
  BookmarkApiError,
  searchResources,
  type PaginationInfo,
  type Resource,
  type SearchResourcesParams,
} from "../api";

interface UseResourceSearchState {
  results: Resource[];
  pagination: PaginationInfo | null;
  isLoading: boolean;
  error: BookmarkApiError | null;
}

interface UseResourceSearchReturn extends UseResourceSearchState {
  search: (
    params: SearchResourcesParams,
    options?: { immediate?: boolean },
  ) => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

const DEBOUNCE_MS = 300;

export function useResourceSearch(
  debounceMs = DEBOUNCE_MS,
): UseResourceSearchReturn {
  const [state, setState] = useState<UseResourceSearchState>({
    results: [],
    pagination: null,
    isLoading: false,
    error: null,
  });
  const [searchParams, setSearchParams] =
    useState<SearchResourcesParams | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);

  const cancelActiveRequest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const executeSearch = useCallback(
    async (
      params: SearchResourcesParams,
      requestId: number,
      signal: AbortSignal,
    ) => {
      try {
        const data = await searchResources(params, { signal });

        if (signal.aborted || requestId !== activeRequestIdRef.current) {
          return;
        }

        setState({
          results: data.resources,
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
            : new BookmarkApiError("Resource search failed", 500);
        setState((prev) => ({ ...prev, isLoading: false, error }));
      }
    },
    [],
  );

  const search = useCallback(
    async (
      params: SearchResourcesParams,
      options: { immediate?: boolean } = {},
    ) => {
      setSearchParams(params);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      cancelActiveRequest();
      const controller = new AbortController();
      abortRef.current = controller;
      activeRequestIdRef.current += 1;
      const requestId = activeRequestIdRef.current;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      if (options.immediate) {
        await executeSearch(params, requestId, controller.signal);
        return;
      }

      debounceRef.current = setTimeout(() => {
        void executeSearch(params, requestId, controller.signal);
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
    const newOffset = state.pagination.offset + state.pagination.limit;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await searchResources(
        {
          ...searchParams,
          offset: newOffset,
        },
        { signal: controller.signal },
      );

      if (controller.signal.aborted || requestId !== activeRequestIdRef.current) {
        return;
      }

      setState((prev) => ({
        results: [...prev.results, ...data.resources],
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
          : new BookmarkApiError("Failed to load more resources", 500);
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, [cancelActiveRequest, searchParams, state.isLoading, state.pagination]);

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

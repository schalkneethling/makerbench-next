import { useCallback, useEffect, useRef, useState } from "react";

import {
  BookmarkApiError,
  getResources,
  type GetResourcesParams,
  type PaginationInfo,
  type Resource,
} from "../api";

interface UseResourcesState {
  resources: Resource[];
  pagination: PaginationInfo | null;
  isLoading: boolean;
  error: BookmarkApiError | null;
}

interface UseResourcesReturn extends UseResourcesState {
  fetch: (params?: GetResourcesParams) => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

export function useResources(): UseResourcesReturn {
  const hasFetched = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
  const [state, setState] = useState<UseResourcesState>({
    resources: [],
    pagination: null,
    isLoading: false,
    error: null,
  });

  const cancelActiveRequest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const fetch = useCallback(async (params?: GetResourcesParams) => {
    cancelActiveRequest();
    const controller = new AbortController();
    abortRef.current = controller;
    activeRequestIdRef.current += 1;
    const requestId = activeRequestIdRef.current;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await getResources(params, { signal: controller.signal });
      if (controller.signal.aborted || requestId !== activeRequestIdRef.current) {
        return;
      }

      setState({
        resources: data.resources,
        pagination: data.pagination,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      if (controller.signal.aborted || requestId !== activeRequestIdRef.current) {
        return;
      }

      const error =
        err instanceof BookmarkApiError
          ? err
          : new BookmarkApiError("Failed to fetch resources", 500);
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, [cancelActiveRequest]);

  const loadMore = useCallback(async () => {
    if (!state.pagination?.hasMore || state.isLoading) {
      return;
    }

    cancelActiveRequest();
    const controller = new AbortController();
    abortRef.current = controller;
    activeRequestIdRef.current += 1;
    const requestId = activeRequestIdRef.current;

    try {
      const newOffset = state.pagination.offset + state.pagination.limit;
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const data = await getResources(
        {
          limit: state.pagination.limit,
          offset: newOffset,
        },
        { signal: controller.signal },
      );

      if (controller.signal.aborted || requestId !== activeRequestIdRef.current) {
        return;
      }

      setState((prev) => ({
        resources: [...prev.resources, ...data.resources],
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
  }, [cancelActiveRequest, state.isLoading, state.pagination]);

  const reset = useCallback(() => {
    cancelActiveRequest();
    setState({
      resources: [],
      pagination: null,
      isLoading: false,
      error: null,
    });
  }, [cancelActiveRequest]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      void fetch();
    }
    return () => {
      cancelActiveRequest();
    };
  }, [cancelActiveRequest, fetch]);

  return {
    ...state,
    fetch,
    loadMore,
    reset,
  };
}

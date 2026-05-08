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
  const [state, setState] = useState<UseResourcesState>({
    resources: [],
    pagination: null,
    isLoading: false,
    error: null,
  });

  const fetch = useCallback(async (params?: GetResourcesParams) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await getResources(params);
      setState({
        resources: data.resources,
        pagination: data.pagination,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const error =
        err instanceof BookmarkApiError
          ? err
          : new BookmarkApiError("Failed to fetch resources", 500);
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
      const data = await getResources({
        limit: state.pagination.limit,
        offset: newOffset,
      });
      setState((prev) => ({
        resources: [...prev.resources, ...data.resources],
        pagination: data.pagination,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      const error =
        err instanceof BookmarkApiError
          ? err
          : new BookmarkApiError("Failed to load more resources", 500);
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, [state.isLoading, state.pagination]);

  const reset = useCallback(() => {
    setState({
      resources: [],
      pagination: null,
      isLoading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      void fetch();
    }
  }, [fetch]);

  return {
    ...state,
    fetch,
    loadMore,
    reset,
  };
}

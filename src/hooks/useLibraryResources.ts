import { useCallback, useEffect, useRef, useState } from "react";

import {
  addLibraryResource,
  BookmarkApiError,
  getLibraryResources,
  type LibraryResource,
} from "../api";
import type { PersonalResourceRequest } from "../lib/validation";

interface UseLibraryResourcesState {
  resources: LibraryResource[];
  isLoading: boolean;
  isSaving: boolean;
  error: BookmarkApiError | null;
}

export function useLibraryResources(accessToken: string | null) {
  const requestIdRef = useRef(0);
  const [state, setState] = useState<UseLibraryResourcesState>({
    resources: [],
    isLoading: false,
    isSaving: false,
    error: null,
  });

  const fetchResources = useCallback(async () => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (!accessToken) {
      setState({
        resources: [],
        isLoading: false,
        isSaving: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await getLibraryResources(accessToken);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setState((prev) => ({
        ...prev,
        resources: data.resources,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      const error =
        err instanceof BookmarkApiError
          ? err
          : new BookmarkApiError("Failed to fetch your library", 500);
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, [accessToken]);

  const addResource = useCallback(
    async (input: PersonalResourceRequest): Promise<boolean> => {
      if (!accessToken) {
        setState((prev) => ({
          ...prev,
          error: new BookmarkApiError("Authentication required", 401),
        }));
        return false;
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        await addLibraryResource(input, accessToken);
        try {
          const data = await getLibraryResources(accessToken);
          setState((prev) => ({
            ...prev,
            resources: data.resources,
            isSaving: false,
            error: null,
          }));
        } catch (refreshError) {
          const error =
            refreshError instanceof BookmarkApiError
              ? refreshError
              : new BookmarkApiError("Failed to refresh your library", 500);
          setState((prev) => ({ ...prev, isSaving: false, error }));
        }
        return true;
      } catch (err) {
        const error =
          err instanceof BookmarkApiError
            ? err
            : new BookmarkApiError("Failed to save this resource", 500);
        setState((prev) => ({ ...prev, isSaving: false, error }));
        return false;
      }
    },
    [accessToken],
  );

  useEffect(() => {
    // This effect synchronizes React state with the server-backed library.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchResources();

    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchResources]);

  return {
    ...state,
    addResource,
    refresh: fetchResources,
  };
}

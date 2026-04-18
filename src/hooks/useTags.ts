import { useEffect, useState } from "react";

import { getTags, type BookmarkApiError, type Tag } from "../api";

interface UseTagsState {
  tags: Tag[];
  isLoading: boolean;
  error: BookmarkApiError | null;
}

/**
 * Fetches homepage tags independently from the bookmark listing payload.
 */
export function useTags(): UseTagsState {
  const [state, setState] = useState<UseTagsState>({
    tags: [],
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    let isActive = true;
    const startedAt =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    getTags()
      .then((data) => {
        if (!isActive) {
          return;
        }

        const durationMs = Math.round(
          (typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : Date.now()) - startedAt,
        );

        console.info("[perf] home-tags", {
          durationMs,
          resultCount: data.tags.length,
        });

        setState({
          tags: data.tags,
          isLoading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setState({
          tags: [],
          isLoading: false,
          error: error as BookmarkApiError,
        });
      });

    return () => {
      isActive = false;
    };
  }, []);

  return state;
}

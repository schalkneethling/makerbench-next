import { useEffect, useState } from "react";

import {
  getTags,
  type BookmarkApiError,
  type GetTagsParams,
  type Tag,
} from "../api";

interface UseTagsState {
  tags: Tag[];
  isLoading: boolean;
  error: BookmarkApiError | null;
}

interface UseTagsOptions extends GetTagsParams {
  enabled?: boolean;
}

/**
 * Fetches homepage tags independently from the bookmark listing payload.
 */
export function useTags(options: UseTagsOptions = {}): UseTagsState {
  const { enabled = true, limit } = options;
  const [state, setState] = useState<UseTagsState>({
    tags: [],
    isLoading: enabled,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    if (!enabled) {
      return () => {
        controller.abort();
      };
    }

    let isActive = true;
    const startedAt =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();

    queueMicrotask(() => {
      if (isActive) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }
    });

    getTags({ limit }, { signal: controller.signal })
      .then((data) => {
        if (!isActive || controller.signal.aborted) {
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
        if (!isActive || controller.signal.aborted) {
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
      controller.abort();
    };
  }, [enabled, limit]);

  return {
    ...state,
    isLoading: enabled ? state.isLoading : false,
  };
}

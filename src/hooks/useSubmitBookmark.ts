import { useState, useCallback } from "react";

import {
  submitBookmark,
  type SubmitBookmarkResponse,
  BookmarkApiError,
} from "../api";
import type { BookmarkRequest } from "../lib/validation";

interface UseSubmitBookmarkState {
  isSubmitting: boolean;
  error: BookmarkApiError | null;
  response: SubmitBookmarkResponse | null;
}

interface UseSubmitBookmarkReturn extends UseSubmitBookmarkState {
  /** Submit a new bookmark */
  submit: (data: BookmarkRequest) => Promise<SubmitBookmarkResponse | null>;
  /** Reset to initial state */
  reset: () => void;
}

/**
 * Hook for submitting new bookmarks
 */
export function useSubmitBookmark(): UseSubmitBookmarkReturn {
  const [state, setState] = useState<UseSubmitBookmarkState>({
    isSubmitting: false,
    error: null,
    response: null,
  });

  const submit = useCallback(
    async (data: BookmarkRequest): Promise<SubmitBookmarkResponse | null> => {
      setState({ isSubmitting: true, error: null, response: null });

      try {
        const response = await submitBookmark(data);
        setState({
          isSubmitting: false,
          error: null,
          response,
        });
        return response;
      } catch (err) {
        const error =
          err instanceof BookmarkApiError
            ? err
            : new BookmarkApiError("Submission failed", 500);
        setState({
          isSubmitting: false,
          error,
          response: null,
        });
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({
      isSubmitting: false,
      error: null,
      response: null,
    });
  }, []);

  return {
    ...state,
    submit,
    reset,
  };
}


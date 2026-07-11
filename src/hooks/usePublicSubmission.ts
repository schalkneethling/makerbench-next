import { useEffect, useRef, useState } from "react";

import {
  PublicSubmissionApiError,
  submitPublicSubmission,
  type PublicSubmissionInput,
  type PublicSubmissionOptions,
  type PublicSubmissionResponse,
} from "../api";

interface UsePublicSubmissionState {
  isSubmitting: boolean;
  error: PublicSubmissionApiError | null;
  response: PublicSubmissionResponse | null;
}

interface UsePublicSubmissionReturn extends UsePublicSubmissionState {
  submit: (
    data: PublicSubmissionInput,
  ) => Promise<PublicSubmissionResponse | null>;
  reset: () => void;
}

/** Manages public submission state and cancels stale requests. */
export function usePublicSubmission(
  options: Pick<PublicSubmissionOptions, "accessToken"> = {},
): UsePublicSubmissionReturn {
  const abortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
  const [state, setState] = useState<UsePublicSubmissionState>({
    isSubmitting: false,
    error: null,
    response: null,
  });

  async function submit(
    data: PublicSubmissionInput,
  ): Promise<PublicSubmissionResponse | null> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    activeRequestIdRef.current += 1;
    const requestId = activeRequestIdRef.current;

    setState({ isSubmitting: true, error: null, response: null });

    try {
      const response = await submitPublicSubmission(data, {
        accessToken: options.accessToken,
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        requestId !== activeRequestIdRef.current
      ) {
        return null;
      }

      setState({ isSubmitting: false, error: null, response });
      return response;
    } catch (error) {
      if (
        controller.signal.aborted ||
        requestId !== activeRequestIdRef.current
      ) {
        return null;
      }

      const submissionError =
        error instanceof PublicSubmissionApiError
          ? error
          : new PublicSubmissionApiError("Submission failed", 500);
      setState({ isSubmitting: false, error: submissionError, response: null });
      return null;
    }
  }

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    activeRequestIdRef.current += 1;
    setState({ isSubmitting: false, error: null, response: null });
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { ...state, submit, reset };
}

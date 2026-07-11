import * as v from "valibot";

import {
  apiErrorResponseSchema,
  publicSubmissionResponseSchema,
  type PublicSubmissionRequest,
  type PublicSubmissionResponseData,
} from "../lib/validation";

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }

  return process.env.API_BASE_URL || "http://localhost:8888";
}

export interface PublicSubmissionOptions {
  accessToken?: string;
  signal?: AbortSignal;
}

export type PublicSubmissionInput = PublicSubmissionRequest;
export type PublicSubmissionResponse = PublicSubmissionResponseData;

export class PublicSubmissionApiError extends Error {
  status: number;
  details?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "PublicSubmissionApiError";
    this.status = status;
    this.details = details;
  }
}

function throwApiError(json: unknown, status: number): never {
  const parsed = v.safeParse(apiErrorResponseSchema, json);
  throw new PublicSubmissionApiError(
    parsed.success ? parsed.output.error : "An unexpected error occurred",
    status,
    parsed.success ? parsed.output.details : undefined,
  );
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new PublicSubmissionApiError("Invalid response from server", 500);
  }
}

/** Submits a tool or resource to the public moderation queue. */
export async function submitPublicSubmission(
  data: PublicSubmissionInput,
  options: PublicSubmissionOptions = {},
): Promise<PublicSubmissionResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${getBaseUrl()}/api/submissions`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
    signal: options.signal,
  });
  const json = await parseJsonResponse(response);

  if (!response.ok) {
    throwApiError(json, response.status);
  }

  const result = v.safeParse(publicSubmissionResponseSchema, json);
  if (!result.success) {
    throw new PublicSubmissionApiError("Invalid response from server", 500);
  }

  return result.output.data;
}

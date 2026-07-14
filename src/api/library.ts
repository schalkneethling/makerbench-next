import * as v from "valibot";

import { BookmarkApiError } from "./bookmarks";
import {
  libraryInspectionResponseSchema,
  type LibraryInspectionResponse,
  type PersonalResourceRequest,
} from "../lib/validation";

const libraryTagSchema = v.object({
  id: v.string(),
  name: v.string(),
});

const libraryResourceSchema = v.object({
  id: v.string(),
  url: v.string(),
  title: v.string(),
  description: v.nullable(v.string()),
  notes: v.string(),
  tags: v.array(libraryTagSchema),
  createdAt: v.string(),
});

const libraryResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    resources: v.array(libraryResourceSchema),
  }),
});

const addLibraryResourceResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    resourceId: v.string(),
    message: v.string(),
  }),
});

const errorResponseSchema = v.object({
  success: v.literal(false),
  error: v.string(),
  details: v.optional(v.record(v.string(), v.array(v.string()))),
});

export type LibraryTag = v.InferOutput<typeof libraryTagSchema>;
export type LibraryResource = v.InferOutput<typeof libraryResourceSchema>;
export type LibraryResponse = v.InferOutput<
  typeof libraryResponseSchema
>["data"];
export type AddLibraryResourceResponse = v.InferOutput<
  typeof addLibraryResourceResponseSchema
>["data"];
export type LibraryInspection = LibraryInspectionResponse["data"];

function throwApiError(json: unknown, status: number): never {
  const parsed = v.safeParse(errorResponseSchema, json);
  throw new BookmarkApiError(
    parsed.success ? parsed.output.error : "An unexpected error occurred",
    status,
    parsed.success ? parsed.output.details : undefined,
  );
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return { success: false, error: "Invalid response from server" };
  }
}

/** Preserves BookmarkApiError values and wraps unknown failures as status 500 using their message or the fallback. */
function toBookmarkApiError(
  error: unknown,
  fallbackMessage: string,
): BookmarkApiError {
  return error instanceof BookmarkApiError
    ? error
    : new BookmarkApiError(
        error instanceof Error ? error.message : fallbackMessage,
        500,
      );
}

export async function getLibraryResources(
  accessToken: string,
): Promise<LibraryResponse> {
  try {
    const response = await fetch("/api/library", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const json = await parseJsonResponse(response);

    if (!response.ok) {
      throwApiError(json, response.status);
    }

    const result = v.safeParse(libraryResponseSchema, json);
    if (!result.success) {
      throw new BookmarkApiError("Invalid response from server", 500);
    }

    return result.output.data;
  } catch (error) {
    throw toBookmarkApiError(error, "Failed to fetch your library");
  }
}

export async function addLibraryResource(
  input: PersonalResourceRequest,
  accessToken: string,
): Promise<AddLibraryResourceResponse> {
  try {
    const response = await fetch("/api/library", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const json = await parseJsonResponse(response);

    if (!response.ok) {
      throwApiError(json, response.status);
    }

    const result = v.safeParse(addLibraryResourceResponseSchema, json);
    if (!result.success) {
      throw new BookmarkApiError("Invalid response from server", 500);
    }

    return result.output.data;
  } catch (error) {
    throw toBookmarkApiError(error, "Failed to save this resource");
  }
}

/** Inspects a resource URL for metadata without saving it. */
export async function inspectLibraryResource(
  url: string,
  accessToken: string,
): Promise<LibraryInspection> {
  const response = await fetch("/api/library/inspect", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
  const json = await parseJsonResponse(response);

  if (!response.ok) {
    throwApiError(json, response.status);
  }

  const result = v.safeParse(libraryInspectionResponseSchema, json);
  if (!result.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return result.output.data;
}

import * as v from "valibot";

import { BookmarkApiError } from "./bookmarks";

const authUserSchema = v.object({
  id: v.string(),
  email: v.nullable(v.string()),
  displayName: v.nullable(v.string()),
  avatarUrl: v.nullable(v.string()),
});

const authenticatedIdentitySchema = v.object({
  user: authUserSchema,
  isAdmin: v.boolean(),
});

const authenticatedIdentityResponseSchema = v.object({
  success: v.literal(true),
  data: authenticatedIdentitySchema,
});

const errorResponseSchema = v.object({
  success: v.literal(false),
  error: v.string(),
  details: v.optional(v.record(v.string(), v.array(v.string()))),
});

export type AuthUser = v.InferOutput<typeof authUserSchema>;
export type AuthenticatedIdentity = v.InferOutput<typeof authenticatedIdentitySchema>;

function throwApiError(json: unknown, status: number): never {
  // Parse API error bodies to preserve structured details from known failures.
  const parsed = v.safeParse(errorResponseSchema, json);
  // BookmarkApiError intentionally propagates so hooks/components decide how to
  // present auth failures; invalid error bodies fall back to a generic message.
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

export async function getAuthenticatedIdentity(
  accessToken: string,
): Promise<AuthenticatedIdentity> {
  let response: Response;

  try {
    response = await fetch("/api/auth/whoami", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    throw new BookmarkApiError(
      error instanceof Error ? error.message : "Authentication request failed",
      500,
    );
  }

  const json = await parseJsonResponse(response);

  if (!response.ok) {
    throwApiError(json, response.status);
  }

  const result = v.safeParse(authenticatedIdentityResponseSchema, json);
  if (!result.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return result.output.data;
}

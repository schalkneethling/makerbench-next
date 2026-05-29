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
  const parsed = v.safeParse(errorResponseSchema, json);
  throw new BookmarkApiError(
    parsed.success ? parsed.output.error : "An unexpected error occurred",
    status,
    parsed.success ? parsed.output.details : undefined,
  );
}

export async function getAuthenticatedIdentity(
  accessToken: string,
): Promise<AuthenticatedIdentity> {
  const response = await fetch("/api/auth/whoami", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const json = await response.json();

  if (!response.ok) {
    throwApiError(json, response.status);
  }

  const result = v.safeParse(authenticatedIdentityResponseSchema, json);
  if (!result.success) {
    throw new BookmarkApiError("Invalid response from server", 500);
  }

  return result.output.data;
}

import { createClient, type User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import { getDb } from "./db";
import { userRolesTable } from "../../../src/db/schema";
import { isValidGithubUsername } from "../../../src/lib/github";

function getEnv(key: string): string | undefined {
  if (typeof Netlify !== "undefined" && Netlify?.env) {
    return Netlify.env.get(key) ?? undefined;
  }

  return undefined;
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function createAuthClient() {
  const supabaseUrl = getEnv("VITE_SUPABASE_URL");
  const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not configured");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export interface AuthenticatedUser {
  user: User;
  isAdmin: boolean;
}

/** Returns a non-empty string property from a Supabase metadata object. */
function getMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Returns a string list property from a Supabase metadata object. */
function getMetadataStringList(metadata: unknown, key: string): string[] {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const value = (metadata as Record<string, unknown>)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/** Resolves the name supplied by Supabase's verified user lookup. */
export function getVerifiedDisplayName(user: User): string | null {
  return (
    getMetadataString(user.user_metadata, "full_name") ??
    getMetadataString(user.user_metadata, "name")
  );
}

/** Resolves a GitHub username only from GitHub-specific Supabase provider data. */
export function getVerifiedGithubUsername(user: User): string | null {
  const githubIdentity = user.identities?.find(
    (identity) => identity.provider === "github",
  );
  const identityUsername = getMetadataString(
    githubIdentity?.identity_data,
    "user_name",
  );
  if (identityUsername && isValidGithubUsername(identityUsername)) {
    return identityUsername;
  }

  const provider = getMetadataString(user.app_metadata, "provider");
  const hasGithubProvider =
    provider === "github" || getMetadataStringList(user.app_metadata, "providers").includes("github");
  const metadataUsername = hasGithubProvider
    ? getMetadataString(user.user_metadata, "user_name")
    : null;

  return metadataUsername && isValidGithubUsername(metadataUsername)
    ? metadataUsername
    : null;
}

export async function verifyAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  const supabase = createAuthClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  const db = getDb();
  const [role] = await db
    .select({ role: userRolesTable.role })
    .from(userRolesTable)
    .where(eq(userRolesTable.userId, data.user.id))
    .limit(1);

  return {
    user: data.user,
    isAdmin: role?.role === "admin",
  };
}

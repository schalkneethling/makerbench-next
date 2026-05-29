import type { Config, Context } from "@netlify/functions";
import type { User } from "@supabase/supabase-js";

import {
  assertRequiredEnv,
  handleMissingEnvironmentError,
  methodNotAllowed,
  ok,
  serverError,
  unauthorized,
  verifyAuthenticatedUser,
} from "./lib";

function getDisplayName(user: User): string | null {
  const metadata = user.user_metadata;
  const fullName = metadata?.full_name;
  const name = metadata?.name;

  return typeof fullName === "string" && fullName.trim().length > 0
    ? fullName
    : typeof name === "string" && name.trim().length > 0
      ? name
      : user.email ?? null;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  try {
    assertRequiredEnv([
      "SUPABASE_DATABASE_URL",
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
    ]);
  } catch (error) {
    return handleMissingEnvironmentError(error, "auth-whoami");
  }

  try {
    const authenticated = await verifyAuthenticatedUser(req);
    if (!authenticated) {
      return unauthorized();
    }

    const { user, isAdmin } = authenticated;

    return ok({
      user: {
        id: user.id,
        email: user.email ?? null,
        displayName: getDisplayName(user),
        avatarUrl:
          typeof user.user_metadata?.avatar_url === "string"
            ? user.user_metadata.avatar_url
            : null,
      },
      isAdmin,
    });
  } catch {
    return serverError("An error occurred while checking authentication");
  }
};

export const config: Config = {
  path: "/api/auth/whoami",
  method: "GET",
};

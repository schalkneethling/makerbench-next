import type { Config, Context } from "@netlify/functions";
import {
  assertRequiredEnv,
  getVerifiedDisplayName,
  getVerifiedGithubUsername,
  handleMissingEnvironmentError,
  methodNotAllowed,
  ok,
  serverError,
  unauthorized,
  verifyAuthenticatedUser,
} from "./lib";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  try {
    assertRequiredEnv(["SUPABASE_DATABASE_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]);
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
        displayName: getVerifiedDisplayName(user),
        githubUsername: getVerifiedGithubUsername(user),
        avatarUrl:
          typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
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

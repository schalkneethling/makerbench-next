import { createClient, type User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import { getDb } from "./db";
import { userRolesTable } from "../../../src/db/schema";

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

export async function verifyAuthenticatedUser(
  req: Request,
): Promise<AuthenticatedUser | null> {
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

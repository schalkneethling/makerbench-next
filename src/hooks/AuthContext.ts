import { createContext } from "react";
import type { Session } from "@supabase/supabase-js";

import type { AuthenticatedIdentity } from "../api";

export interface AuthContextValue {
  identity: AuthenticatedIdentity | null;
  session: Session | null;
  accessToken: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

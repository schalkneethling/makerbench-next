import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { getAuthenticatedIdentity, type AuthenticatedIdentity } from "../api";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
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

const AuthContext = createContext<AuthContextValue | null>(null);

function getRedirectUrl(): string {
  return window.location.origin;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<AuthenticatedIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  async function refreshIdentityForSession(nextSession: Session | null) {
    setSession(nextSession);

    if (!nextSession) {
      setIdentity(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const nextIdentity = await getAuthenticatedIdentity(nextSession.access_token);
      setIdentity(nextIdentity);
    } catch (err) {
      setIdentity(null);
      setError(err instanceof Error ? err : new Error("Authentication failed"));
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshIdentity() {
    const {
      data: { session: nextSession },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError(sessionError);
      setIsLoading(false);
      return;
    }

    await refreshIdentityForSession(nextSession);
  }

  const refreshIdentityEvent = useEffectEvent(refreshIdentity);
  const refreshIdentityForSessionEvent = useEffectEvent(refreshIdentityForSession);

  useEffect(() => {
    // This effect synchronizes React state with Supabase's external auth store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshIdentityEvent();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Supabase recommends deferring async auth work from the auth callback.
      setTimeout(() => {
        void refreshIdentityForSessionEvent(nextSession);
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectUrl(),
      },
    });

    if (signInError) {
      throw signInError;
    }
  }

  async function signInWithGitHub() {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: getRedirectUrl(),
      },
    });

    if (signInError) {
      throw signInError;
    }
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut({
      scope: "local",
    });

    if (signOutError) {
      throw signOutError;
    }

    setSession(null);
    setIdentity(null);
  }

  const value: AuthContextValue = {
    identity,
    session,
    accessToken: session?.access_token ?? null,
    isAdmin: identity?.isAdmin ?? false,
    isAuthenticated: Boolean(identity),
    isLoading,
    error,
    signInWithGoogle,
    signInWithGitHub,
    signOut,
    refreshIdentity,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const value = use(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}

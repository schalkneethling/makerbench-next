import { useCallback, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { getAuthenticatedIdentity, type AuthenticatedIdentity } from "../api";
import { supabase } from "../lib/supabase";
import { AuthContext, type AuthContextValue } from "./AuthContext";

function getRedirectUrl(): string {
  return window.location.origin;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<AuthenticatedIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshIdentityForSession = useCallback(async (nextSession: Session | null) => {
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
  }, []);

  const refreshIdentity = useCallback(async () => {
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
  }, [refreshIdentityForSession]);

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

  const signInWithGoogle = useCallback(async () => {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectUrl(),
      },
    });

    if (signInError) {
      throw signInError;
    }
  }, []);

  const signInWithGitHub = useCallback(async () => {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: getRedirectUrl(),
      },
    });

    if (signInError) {
      throw signInError;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut({
      scope: "local",
    });

    if (signOutError) {
      throw signOutError;
    }

    setSession(null);
    setIdentity(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
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
  }, [
    error,
    identity,
    isLoading,
    refreshIdentity,
    session,
    signInWithGitHub,
    signInWithGoogle,
    signOut,
  ]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

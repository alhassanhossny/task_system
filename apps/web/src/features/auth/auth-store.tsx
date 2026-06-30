"use client";

import type { AuthUser } from "@taskflow/types";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
}

interface AuthContextValue extends SessionState {
  setSession: (session: Required<SessionState>) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const storageKey = "taskflow.session";

function readInitialSession(): SessionState {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, user: null };
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return { accessToken: null, refreshToken: null, user: null };
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    window.localStorage.removeItem(storageKey);
    return { accessToken: null, refreshToken: null, user: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<SessionState>({ accessToken: null, refreshToken: null, user: null });

  useEffect(() => {
    setSessionState(readInitialSession());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      setSession(nextSession) {
        setSessionState(nextSession);
        window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
      },
      clearSession() {
        const empty = { accessToken: null, refreshToken: null, user: null };
        setSessionState(empty);
        window.localStorage.removeItem(storageKey);
      }
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

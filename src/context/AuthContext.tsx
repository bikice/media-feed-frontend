import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as api from '@/lib/api';
import { loadTokens, saveTokens, clearTokens } from '@/lib/tokenStorage';
import { onSessionExpired } from '@/lib/http';

interface AuthContextValue {
  isAuthenticated: boolean;
  isInitializing: boolean;
  username: string | null;
  error: string | null;
  isSubmitting: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

function usernameFromJwt(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.username ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { token: stored } = loadTokens();
    setToken(stored);
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    return onSessionExpired(() => setToken(null));
  }, []);

  const doLogin = useCallback(async (email: string, password: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      // login_check only documents a `token` in its response schema; some
      // deployments also return a refresh_token alongside it.
      const refreshToken = (res as { refresh_token?: string }).refresh_token ?? null;
      saveTokens({ token: res.token, refreshToken });
      setToken(res.token);
    } catch {
      setError('Could not sign in. Check your email and password and try again.');
      throw new Error('login-failed');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const doLogout = useCallback(async () => {
    const { refreshToken } = loadTokens();
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      // Best-effort. Even if the server call fails, clear the local session.
    } finally {
      clearTokens();
      setToken(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: !!token,
      isInitializing,
      username: token ? usernameFromJwt(token) : null,
      error,
      isSubmitting,
      login: doLogin,
      logout: doLogout,
    }),
    [token, isInitializing, error, isSubmitting, doLogin, doLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

'use client';

import { createContext, useContext, useEffect, useCallback, useState, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from './auth-store';
import { apiClient, refreshAccessToken, setApiRequestSignal } from '../api/api';
import type { IUser } from '../types/domain';

interface AuthState {
  user: IUser | null;
  workspace: { id: string; name: string } | null;
  apiKey: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  setActiveWorkspace: (ws: { id: string; name: string }) => void;
  setApiKey: (key: string | null) => void;
  getAbortSignal: () => AbortSignal;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setAuth, clearAuth } = useAuthStore();
  const abortControllerRef = useRef<AbortController>(new AbortController());

  const [workspace, setWorkspaceState] = useState<{ id: string; name: string } | null>(null);
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const sessionBootstrapRef = useRef(false);

  const getAbortSignal = useCallback(() => {
    return abortControllerRef.current.signal;
  }, []);

  useEffect(() => {
    setApiRequestSignal(abortControllerRef.current.signal);
  }, []);

  useEffect(() => {
    if (sessionBootstrapRef.current) return;
    sessionBootstrapRef.current = true;

    const verifySession = async () => {
      try {
        const accessToken = await refreshAccessToken();
        if (accessToken) {
          useAuthStore.getState().setAuth(
            user || { id: '', email: '' },
            accessToken
          );
          const meRes = await apiClient.get<IUser>('/api/v1/auth/me');
          if (meRes.success) {
            setAuth(meRes.data, accessToken);
          } else {
            clearAuth();
          }
        } else {
          clearAuth();
        }
      } catch {
        clearAuth();
      }
    };

    verifySession();
  }, [clearAuth, setAuth, user]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiClient.post<{ user: IUser; accessToken: string }>('/api/v1/auth/login', {
        email,
        password,
      }, { skipAuth: true });

      if (!res.success) {
        let errorMsg = res.error?.message || 'Invalid credentials';
        if (res.error?.details) {
          const firstDetail = Object.values(res.error.details as Record<string, string[]>)[0];
          if (Array.isArray(firstDetail) && firstDetail.length > 0) {
            errorMsg = firstDetail[0];
          }
        }
        return { success: false, error: errorMsg };
      }

      setAuth(res.data.user, res.data.accessToken);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error during login' };
    }
  }, [setAuth]);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    try {
      const res = await apiClient.post<{ user: IUser }>('/api/v1/auth/register', {
        name,
        email,
        password,
      }, { skipAuth: true });

      if (!res.success) {
        let errorMsg = res.error?.message || 'Registration failed';
        if (res.error?.details) {
          const firstDetail = Object.values(res.error.details as Record<string, string[]>)[0];
          if (Array.isArray(firstDetail) && firstDetail.length > 0) {
            errorMsg = firstDetail[0];
          }
        }
        return { success: false, error: errorMsg };
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Network error during signup' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } catch {
      // Ignore network errors during logout
    }
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setApiRequestSignal(abortControllerRef.current.signal);

    clearAuth();
    setWorkspaceState(null);
    setApiKeyState(null);
    if (typeof window !== 'undefined') {
      router.replace('/login');
    }
  }, [clearAuth, router]);

  const logoutAll = useCallback(async () => {
    try {
      await apiClient.post('/api/v1/auth/logout-all');
    } catch {
      // Ignore network errors
    }
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setApiRequestSignal(abortControllerRef.current.signal);

    clearAuth();
    setWorkspaceState(null);
    setApiKeyState(null);
    if (typeof window !== 'undefined') {
      router.replace('/login');
    }
  }, [clearAuth, router]);

  const setActiveWorkspace = useCallback((ws: { id: string; name: string }) => {
    // Abort active in-flight requests for prior workspace
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setApiRequestSignal(abortControllerRef.current.signal);

    setWorkspaceState(ws);
  }, []);

  const setApiKey = useCallback((key: string | null) => {
    setApiKeyState(key);
  }, []);

  const value: AuthContextValue = {
    user,
    workspace,
    apiKey,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    logoutAll,
    setActiveWorkspace,
    setApiKey,
    getAbortSignal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

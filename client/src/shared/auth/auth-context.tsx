'use client';

import { createContext, useContext, useEffect, useCallback, useState, useRef, type ReactNode } from 'react';
import { useAuthStore } from './auth-store';
import { apiClient } from '../api/api';
import type { IUser, IWorkspace } from '../types/domain';

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
  const { user, isAuthenticated, isLoading, setAuth, clearAuth } = useAuthStore();
  const abortControllerRef = useRef<AbortController>(new AbortController());

  const [workspace, setWorkspaceState] = useState<{ id: string; name: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const storedWsId = localStorage.getItem('varta_ws_id');
    const storedWsName = localStorage.getItem('varta_ws_name');
    return storedWsId && storedWsName ? { id: storedWsId, name: storedWsName } : null;
  });

  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('varta_api_key');
  });

  const getAbortSignal = useCallback(() => {
    return abortControllerRef.current.signal;
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const refreshRes = await apiClient.post<{ accessToken: string }>('/api/v1/auth/refresh', undefined, { skipAuth: true });
        if (refreshRes.success && refreshRes.data?.accessToken) {
          useAuthStore.getState().setAuth(
            user || { id: '', email: '' },
            refreshRes.data.accessToken
          );
          const meRes = await apiClient.get<IUser>('/api/v1/auth/me');
          if (meRes.success && meRes.data) {
            setAuth(meRes.data, refreshRes.data.accessToken);
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
  }, [setAuth, clearAuth]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiClient.post<{ user: IUser; accessToken: string }>('/api/v1/auth/login', {
        email,
        password,
      }, { skipAuth: true });

      if (!res.success || !res.data) {
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

      return login(email, password);
    } catch {
      return { success: false, error: 'Network error during signup' };
    }
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } catch {
      // Ignore network errors during logout
    }
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    clearAuth();
    setWorkspaceState(null);
    setApiKeyState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('varta_ws_id');
      localStorage.removeItem('varta_ws_name');
      localStorage.removeItem('varta_api_key');
      window.location.href = '/login';
    }
  }, [clearAuth]);

  const logoutAll = useCallback(async () => {
    try {
      await apiClient.post('/api/v1/auth/logout-all');
    } catch {
      // Ignore network errors
    }
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    clearAuth();
    setWorkspaceState(null);
    setApiKeyState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('varta_ws_id');
      localStorage.removeItem('varta_ws_name');
      localStorage.removeItem('varta_api_key');
      window.location.href = '/login';
    }
  }, [clearAuth]);

  const setActiveWorkspace = useCallback((ws: { id: string; name: string }) => {
    // Abort active in-flight requests for prior workspace
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setWorkspaceState(ws);
    if (typeof window !== 'undefined') {
      localStorage.setItem('varta_ws_id', ws.id);
      localStorage.setItem('varta_ws_name', ws.name);
    }
  }, []);

  const setApiKey = useCallback((key: string | null) => {
    setApiKeyState(key);
    if (typeof window !== 'undefined') {
      if (key) {
        localStorage.setItem('varta_api_key', key);
      } else {
        localStorage.removeItem('varta_api_key');
      }
    }
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

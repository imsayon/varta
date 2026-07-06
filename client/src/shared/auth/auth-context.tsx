'use client';

import { createContext, useContext, useEffect, useCallback, useState, type ReactNode } from 'react';
import { useAuthStore } from './auth-store';

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
  setActiveWorkspace: (ws: { id: string; name: string }) => void;
  setApiKey: (key: string) => void;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, setAuth, clearAuth } = useAuthStore();
  
  // Keep local storage synced values here for simplicity, though they could also be in Zustand
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

  useEffect(() => {
    // Check initial auth state by calling /me or /refresh
    const verifySession = async () => {
      try {
        const response = await fetch('/api/v1/auth/refresh', { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          // After getting token, fetch the user profile or parse from JWT
          const meResponse = await fetch('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${data.data.accessToken}` }
          });
          if (meResponse.ok) {
            const meData = await meResponse.json();
            setAuth(meData.data as IUser, data.data.accessToken);
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
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      if (!response.ok) {
        let errorMsg = data.message || 'Invalid credentials';
        if (data.details) {
          const firstDetail = Object.values(data.details)[0];
          if (Array.isArray(firstDetail) && firstDetail.length > 0) {
            errorMsg = firstDetail[0] as string;
          }
        }
        return { success: false, error: errorMsg };
      }

      setAuth(data.data.user as IUser, data.data.accessToken);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error during login' };
    }
  }, [setAuth]);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        let errorMsg = data.message || 'Registration failed';
        if (data.details) {
          const firstDetail = Object.values(data.details)[0];
          if (Array.isArray(firstDetail) && firstDetail.length > 0) {
            errorMsg = firstDetail[0] as string;
          }
        }
        return { success: false, error: errorMsg };
      }
      
      // Auto login after signup
      return login(email, password);
    } catch {
      return { success: false, error: 'Network error during signup' };
    }
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    clearAuth();
    setWorkspaceState(null);
    setApiKeyState(null);
    localStorage.removeItem('varta_ws_id');
    localStorage.removeItem('varta_ws_name');
    localStorage.removeItem('varta_api_key');
    
    // Hard reload or push to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, [clearAuth]);

  const setActiveWorkspace = useCallback((ws: { id: string; name: string }) => {
    setWorkspaceState(ws);
    localStorage.setItem('varta_ws_id', ws.id);
    localStorage.setItem('varta_ws_name', ws.name);
  }, []);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    localStorage.setItem('varta_api_key', key);
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
    setActiveWorkspace,
    setApiKey,
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

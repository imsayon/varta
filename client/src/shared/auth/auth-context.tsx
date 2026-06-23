'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';
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
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setActiveWorkspace: (ws: { id: string; name: string }) => void;
  setApiKey: (key: string) => void;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  // Map session user to our IUser type
  const user: IUser | null = session?.user ? {
    id: session.user.id || '',
    email: session.user.email || '',
  } : null;

  useEffect(() => {
    const storedWsId = localStorage.getItem('varta_ws_id');
    const storedWsName = localStorage.getItem('varta_ws_name');
    const storedApiKey = localStorage.getItem('varta_api_key');

    if (storedWsId && storedWsName) {
      setWorkspace({ id: storedWsId, name: storedWsName });
    }
    if (storedApiKey) {
      setApiKeyState(storedApiKey);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await nextAuthSignIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      return { success: false, error: 'Invalid email or password' };
    }
    return { success: true };
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Signup failed' };
      }
      
      // Auto login after signup
      return login(email, password);
    } catch (error) {
      return { success: false, error: 'Network error during signup' };
    }
  }, [login]);

  const logout = useCallback(() => {
    nextAuthSignOut({ redirect: true, callbackUrl: '/login' });
    setWorkspace(null);
    setApiKeyState(null);
    localStorage.removeItem('varta_ws_id');
    localStorage.removeItem('varta_ws_name');
    localStorage.removeItem('varta_api_key');
  }, []);

  const setActiveWorkspace = useCallback((ws: { id: string; name: string }) => {
    setWorkspace(ws);
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
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
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

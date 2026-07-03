import { useAuthStore } from '../auth/auth-store';
import type { ApiResponse } from '../types/domain';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Custom fetch wrapper that automatically injects the access token and handles 401 retries.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const getAccessToken = () => useAuthStore.getState().accessToken;
  const clearAuth = () => useAuthStore.getState().clearAuth();
  const setAuth = (user: any, token: string) => useAuthStore.getState().setAuth(user, token);

  const headers = new Headers(options.headers);
  
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  let response = await fetch(url, fetchOptions);

  if (response.status === 401) {
    try {
      const refreshResponse = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newAccessToken = refreshData.data?.accessToken;
        const currentUser = useAuthStore.getState().user;

        if (newAccessToken && currentUser) {
          setAuth(currentUser, newAccessToken);
          headers.set('Authorization', `Bearer ${newAccessToken}`);
          response = await fetch(url, { ...options, headers });
        } else {
          throw new Error('Refresh response missing token');
        }
      } else {
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    } catch (err) {
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }

  return response;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetchWithAuth(path, init);

    let body: ApiResponse<T>;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      body = (await response.json()) as ApiResponse<T>;
    } else if (response.status === 204) {
      body = { success: true } as ApiResponse<T>;
    } else {
      const text = await response.text();
      body = { success: response.ok, message: text } as ApiResponse<T>;
    }

    if (!response.ok && !body.error) {
      body.success = false;
      body.error = {
        message: body.message ?? `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected network error occurred';
    return {
      success: false,
      error: { message, status: 0 },
    };
  }
}

export const apiClient = {
  get<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'GET' });
  },
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  del<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'DELETE' });
  },
} as const;

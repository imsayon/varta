import { useAuthStore } from '../auth/auth-store';

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
  
  // 1. Inject Token
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Ensure JSON by default if we are sending data
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  // 2. Initial Request
  let response = await fetch(url, fetchOptions);

  // 3. Handle 401 Unauthorized (Token Expiration)
  if (response.status === 401) {
    try {
      // Attempt to refresh the token using the HttpOnly cookie
      const refreshResponse = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newAccessToken = refreshData.data?.accessToken;
        const currentUser = useAuthStore.getState().user;

        if (newAccessToken && currentUser) {
          // Update store with new token
          setAuth(currentUser, newAccessToken);

          // Retry original request with new token
          headers.set('Authorization', `Bearer ${newAccessToken}`);
          response = await fetch(url, { ...options, headers });
        } else {
          throw new Error('Refresh response missing token');
        }
      } else {
        // Refresh failed (e.g. cookie expired or invalid)
        clearAuth();
        // Since we are running in the browser, we might want to let the middleware handle
        // redirects, or we can manually push to /login.
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    } catch (err) {
      // Refresh network error
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }

  return response;
}

/**
 * Convenience method for getting JSON data directly.
 */
export async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetchWithAuth(url, options);
  
  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.message || data?.message || 'API Error', data);
  }

  return data;
}

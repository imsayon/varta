// ============================================================================
// Varta – Type-Safe API Client
// ============================================================================
// A thin wrapper around the native `fetch` API that:
//   • Auto-injects the JWT bearer token from localStorage.
//   • Provides generic, type-safe helpers: get, post, put, del.
//   • Redirects to /login and clears credentials on 401 responses.
//   • Uses relative paths so Next.js rewrites can proxy to the backend.
// ============================================================================

import type { ApiResponse } from '../types/domain';

/** localStorage key where the JWT is persisted. */
const TOKEN_KEY = 'varta_token';

/* -------------------------------------------------------------------------- */
/*  Internal Helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Safely retrieve the JWT from localStorage.
 *
 * Returns `null` when running in a server context (SSR) or when no token
 * has been stored.
 */
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Handle an HTTP 401 by clearing persisted auth state and redirecting
 * the user to the login page.
 */
function handleUnauthorised(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('varta_ws_id');
  localStorage.removeItem('varta_ws_name');
  localStorage.removeItem('varta_api_key');

  // Use replaceState so the user can't "back" into a broken session.
  window.location.replace('/login');
}

/**
 * Build a standard `Headers` object for every outgoing request.
 *
 * @param hasBody - When `true`, the `Content-Type: application/json` header is
 *                  added so the backend knows how to parse the payload.
 */
function buildHeaders(hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/* -------------------------------------------------------------------------- */
/*  Core Request Function                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Execute an HTTP request and return a typed `ApiResponse<T>`.
 *
 * All network and parsing errors are caught and normalised into a failed
 * `ApiResponse` so callers never need try/catch blocks.
 *
 * @typeParam T - Expected shape of the response `data` on success.
 * @param path   - Relative URL path (e.g. `/api/v1/workspaces`).
 * @param init   - Standard `RequestInit` overrides.
 * @returns A promise resolving to a typed API response envelope.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...buildHeaders(init.body !== undefined && init.body !== null),
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    // --- 401 Unauthorised – session expired or invalid token ------------- //
    if (response.status === 401) {
      handleUnauthorised();
      return {
        success: false,
        error: {
          message: 'Session expired. Please log in again.',
          status: 401,
        },
      };
    }

    // --- Attempt to parse the JSON body ---------------------------------- //
    // Some endpoints (e.g. 204 No Content) may not return a body.
    let body: ApiResponse<T>;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      body = (await response.json()) as ApiResponse<T>;
    } else if (response.status === 204) {
      body = { success: true } as ApiResponse<T>;
    } else {
      // Non-JSON, non-204: treat the raw text as a message.
      const text = await response.text();
      body = {
        success: response.ok,
        message: text,
      } as ApiResponse<T>;
    }

    // If the HTTP status signals an error but the body didn't include one,
    // synthesise a structured error.
    if (!response.ok && !body.error) {
      body.success = false;
      body.error = {
        message: body.message ?? `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return body;
  } catch (err) {
    // Network failure, DNS error, CORS issue, JSON parse error, etc.
    const message =
      err instanceof Error ? err.message : 'An unexpected network error occurred';

    return {
      success: false,
      error: {
        message,
        status: 0, // 0 signals a client-side / network-level failure.
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Type-safe API client for the Varta backend.
 *
 * @example
 * ```ts
 * import { apiClient } from '@/shared/api/api-client';
 * import type { IWorkspace } from '@/shared/types/domain';
 *
 * const res = await apiClient.get<IWorkspace[]>('/api/v1/workspaces');
 * if (res.success && res.data) {
 *   console.log(res.data);
 * }
 * ```
 */
export const apiClient = {
  /**
   * Perform a GET request.
   *
   * @typeParam T - Expected shape of `data` in the response.
   * @param path - Relative URL path.
   */
  get<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'GET' });
  },

  /**
   * Perform a POST request with a JSON body.
   *
   * @typeParam T - Expected shape of `data` in the response.
   * @param path - Relative URL path.
   * @param body - Request payload (will be JSON-stringified).
   */
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * Perform a PUT request with a JSON body.
   *
   * @typeParam T - Expected shape of `data` in the response.
   * @param path - Relative URL path.
   * @param body - Request payload (will be JSON-stringified).
   */
  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * Perform a DELETE request.
   *
   * @typeParam T - Expected shape of `data` in the response.
   * @param path - Relative URL path.
   */
  del<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'DELETE' });
  },
} as const;

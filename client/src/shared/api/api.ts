import { useAuthStore } from "../auth/auth-store"
import type { ApiResponse, IApiMeta, IUser } from "../types/domain"

export interface RequestOptions extends RequestInit {
	params?: Record<string, string | number | boolean | undefined | null>
	idempotencyKey?: string
	retries?: number
	skipAuth?: boolean
}

export class ApiError extends Error {
	public readonly status: number
	public readonly code: string
	public readonly details?: Record<string, string[]> | unknown
	public readonly meta?: IApiMeta

	constructor(
		status: number,
		code: string,
		message: string,
		details?: Record<string, string[]> | unknown,
		meta?: IApiMeta,
	) {
		super(message)
		this.name = "ApiError"
		this.status = status
		this.code = code
		this.details = details
		this.meta = meta
	}

	get isForbidden(): boolean {
		return this.status === 403 || this.code === "FORBIDDEN"
	}

	get isUnauthorized(): boolean {
		return this.status === 401 || this.code === "UNAUTHORIZED"
	}

	get isRateLimit(): boolean {
		return this.status === 429 || this.code === "TOO_MANY_REQUESTS"
	}

	get isTransient(): boolean {
		return (
			this.status === 0 ||
			this.status === 429 ||
			this.status === 502 ||
			this.status === 503 ||
			this.status === 504
		)
	}

	get isTerminal(): boolean {
		return !this.isTransient
	}
}

// Single-flight refresh token queue to prevent race conditions on concurrent 401s
let refreshPromise: Promise<string | null> | null = null

async function executeTokenRefresh(): Promise<string | null> {
	if (refreshPromise) return refreshPromise

	refreshPromise = (async () => {
		try {
			const res = await fetch("/api/v1/auth/refresh", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			})

			if (res.ok) {
				const body = await res.json()
				const newAccessToken = body.data?.accessToken
				const currentUser = useAuthStore.getState().user

				if (newAccessToken && currentUser) {
					useAuthStore.getState().setAuth(currentUser, newAccessToken)
					return newAccessToken
				}
			}
			useAuthStore.getState().clearAuth()
			if (typeof window !== "undefined") {
				window.location.href = "/login"
			}
			return null
		} catch {
			useAuthStore.getState().clearAuth()
			if (typeof window !== "undefined") {
				window.location.href = "/login"
			}
			return null
		} finally {
			refreshPromise = null
		}
	})()

	return refreshPromise
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
	const baseUrl = process.env.NEXT_PUBLIC_API_URL || ""
	const fullPath = path.startsWith("http") ? path : `${baseUrl}${path}`

	if (!params) return fullPath

	const url = new URL(fullPath, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== "") {
			url.searchParams.append(key, String(val))
		}
	})
	return url.toString()
}

/**
 * Universal fetch wrapper for Varta API.
 */
export async function fetchWithAuth(
	url: string,
	options: RequestOptions = {},
): Promise<Response> {
	const { skipAuth, idempotencyKey, ...fetchInit } = options
	const headers = new Headers(fetchInit.headers)

	if (!skipAuth) {
		const token = useAuthStore.getState().accessToken
		if (token) {
			headers.set("Authorization", `Bearer ${token}`)
		}
	}

	if (fetchInit.body && !headers.has("Content-Type") && !(fetchInit.body instanceof FormData)) {
		headers.set("Content-Type", "application/json")
	}

	if (idempotencyKey) {
		headers.set("X-Idempotency-Key", idempotencyKey)
		headers.set("Idempotency-Key", idempotencyKey)
	}

	let response = await fetch(url, { ...fetchInit, headers })

	if (response.status === 401 && !skipAuth && !url.includes("/auth/refresh")) {
		const newAccessToken = await executeTokenRefresh()
		if (newAccessToken) {
			headers.set("Authorization", `Bearer ${newAccessToken}`)
			response = await fetch(url, { ...fetchInit, headers })
		}
	}

	return response
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
	const { params, retries = 0, ...fetchOptions } = options
	const url = buildUrl(path, params)

	let attempts = 0
	const maxAttempts = (fetchOptions.method === "GET" || options.idempotencyKey) ? retries + 1 : 1

	while (attempts < maxAttempts) {
		attempts++
		try {
			const response = await fetchWithAuth(url, fetchOptions)
			const contentType = response.headers.get("content-type")
			const requestId = response.headers.get("x-request-id") || undefined

			if (contentType?.includes("application/json")) {
				const body = (await response.json()) as any

				if (response.ok && body.success !== false) {
					return {
						success: true,
						data: (body.data !== undefined ? body.data : body) as T,
						meta: { requestId, ...body.meta },
					}
				}

				const errCode = body.error?.code || body.code || `HTTP_${response.status}`
				const errMsg = body.error?.message || body.error || body.message || `Request failed with status ${response.status}`
				const errDetails = body.error?.details || body.details
				const apiError = new ApiError(response.status, errCode, errMsg, errDetails, { requestId, ...body.meta })

				if (apiError.isTransient && attempts < maxAttempts) {
					await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, attempts), 4000)))
					continue
				}

				return {
					success: false,
					error: {
						message: apiError.message,
						code: apiError.code,
						status: apiError.status,
						details: apiError.details as Record<string, string[]>,
					},
					meta: { requestId, ...body.meta },
				}
			}

			if (response.ok) {
				return {
					success: true,
					data: undefined as unknown as T,
					meta: { requestId },
				}
			}

			const text = await response.text()
			const apiError = new ApiError(response.status, `HTTP_${response.status}`, text || `HTTP ${response.status}`, undefined, { requestId })

			if (apiError.isTransient && attempts < maxAttempts) {
				await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, attempts), 4000)))
				continue
			}

			return {
				success: false,
				error: {
					message: apiError.message,
					code: apiError.code,
					status: apiError.status,
				},
				meta: { requestId },
			}
		} catch (err) {
			const isAbort = err instanceof Error && err.name === "AbortError"
			if (isAbort) {
				return {
					success: false,
					error: { message: "Request cancelled", code: "ABORT_ERROR", status: 0 },
				}
			}

			if (attempts < maxAttempts) {
				await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, attempts), 4000)))
				continue
			}

			const msg = err instanceof Error ? err.message : "Network error"
			return {
				success: false,
				error: { message: msg, code: "NETWORK_ERROR", status: 0 },
			}
		}
	}

	return {
		success: false,
		error: { message: "Max retries exceeded", code: "MAX_RETRIES_EXCEEDED", status: 0 },
	}
}

export const apiClient = {
	get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
		return request<T>(path, { ...options, method: "GET" })
	},
	post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
		return request<T>(path, {
			...options,
			method: "POST",
			body: body !== undefined ? JSON.stringify(body) : undefined,
			idempotencyKey: options?.idempotencyKey || `idemp_${Math.random().toString(36).slice(2)}`,
		})
	},
	put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
		return request<T>(path, {
			...options,
			method: "PUT",
			body: body !== undefined ? JSON.stringify(body) : undefined,
			idempotencyKey: options?.idempotencyKey || `idemp_${Math.random().toString(36).slice(2)}`,
		})
	},
	patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
		return request<T>(path, {
			...options,
			method: "PATCH",
			body: body !== undefined ? JSON.stringify(body) : undefined,
			idempotencyKey: options?.idempotencyKey || `idemp_${Math.random().toString(36).slice(2)}`,
		})
	},
	del<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
		return request<T>(path, { ...options, method: "DELETE" })
	},
} as const

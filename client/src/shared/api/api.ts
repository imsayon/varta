import { useAuthStore } from "../auth/auth-store"
import type { ApiResponse, IApiMeta, IApiError, IUser } from "../types/domain"

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
		return this.status === 0 || this.status === 429 || this.status === 502 || this.status === 503 || this.status === 504
	}

	get isTerminal(): boolean {
		return !this.isTransient
	}
}

let refreshPromise: Promise<string | null> | null = null
let activeRequestSignal: AbortSignal | undefined

export function setApiRequestSignal(signal: AbortSignal): void {
	activeRequestSignal = signal
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asMeta(value: unknown): IApiMeta {
	return isRecord(value) ? (value as IApiMeta) : {}
}

function asApiError(value: unknown, status: number): IApiError {
	if (isRecord(value)) {
		const code = typeof value.code === "string" ? value.code : `HTTP_${status}`
		const message = typeof value.message === "string" ? value.message : `Request failed with status ${status}`
		return {
			code,
			message,
			status,
			...(value.details !== undefined ? { details: value.details } : {}),
		}
	}
	return {
		code: `HTTP_${status}`,
		message: typeof value === "string" && value.length > 0 ? value : `Request failed with status ${status}`,
		status,
	}
}

async function readJson(response: Response): Promise<unknown> {
	const contentType = response.headers.get("content-type")
	if (!contentType?.includes("application/json")) return undefined
	try {
		return await response.json()
	} catch {
		return undefined
	}
}

export async function refreshAccessToken(): Promise<string | null> {
	if (refreshPromise) return refreshPromise

	refreshPromise = (async () => {
		try {
			const response = await fetch("/api/v1/auth/refresh", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
			})
			const body = await readJson(response)
			const token = isRecord(body) && isRecord(body.data) && typeof body.data.accessToken === "string"
				? body.data.accessToken
				: null
			const currentUser = useAuthStore.getState().user
			if (response.ok && token && currentUser) {
				useAuthStore.getState().setAuth(currentUser, token)
				return token
			}
			if (!response.ok) useAuthStore.getState().clearAuth()
			return response.ok ? token : null
		} catch {
			useAuthStore.getState().clearAuth()
			return null
		} finally {
			refreshPromise = null
		}
	})()

	return refreshPromise
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
	// Keep browser requests and refresh cookies on the same origin.
	if (!params) return path

	const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value))
	})
	return url.toString()
}

async function fetchWithAuth(url: string, options: RequestOptions = {}): Promise<Response> {
	const { skipAuth, idempotencyKey, ...fetchInit } = options
	const headers = new Headers(fetchInit.headers)
	if (!skipAuth) {
		const token = useAuthStore.getState().accessToken
		if (token) headers.set("Authorization", `Bearer ${token}`)
	}
	if (fetchInit.body && !headers.has("Content-Type") && !(fetchInit.body instanceof FormData)) {
		headers.set("Content-Type", "application/json")
	}
	if (idempotencyKey) {
		headers.set("X-Idempotency-Key", idempotencyKey)
		headers.set("Idempotency-Key", idempotencyKey)
	}

	const requestInit: RequestInit = {
		...fetchInit,
		headers,
		credentials: fetchInit.credentials ?? "include",
		signal: fetchInit.signal ?? activeRequestSignal,
	}
	let response = await fetch(url, requestInit)
	if (response.status === 401 && !skipAuth && !url.includes("/auth/refresh")) {
		const newAccessToken = await refreshAccessToken()
		if (newAccessToken) {
			headers.set("Authorization", `Bearer ${newAccessToken}`)
			response = await fetch(url, requestInit)
		}
	}
	return response
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
	const { params, retries = 0, ...fetchOptions } = options
	const url = buildUrl(path, params)
	const maxAttempts = (fetchOptions.method === "GET" || Boolean(options.idempotencyKey)) ? retries + 1 : 1

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const response = await fetchWithAuth(url, fetchOptions)
			const requestId = response.headers.get("x-request-id") || undefined
			const body = await readJson(response)
			if (response.ok) {
				if (isRecord(body) && body.success === true) {
					return {
						success: true,
						data: body.data as T,
						meta: { ...asMeta(body.meta), ...(requestId ? { requestId } : {}) },
					}
				}
				return { success: true, data: body as T, meta: requestId ? { requestId } : {} }
			}

			let rawError: unknown = isRecord(body) ? body.error : undefined
			if (rawError === undefined && isRecord(body)) rawError = body.message
			const error = asApiError(rawError, response.status)
			if (error.status === 429 || error.status === 502 || error.status === 503 || error.status === 504) {
				if (attempt < maxAttempts) {
					await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 4000)))
					continue
				}
			}
			return {
				success: false,
				error,
				meta: { ...(isRecord(body) ? asMeta(body.meta) : {}), ...(requestId ? { requestId } : {}) },
			}
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				return { success: false, error: { code: "ABORT_ERROR", message: "Request cancelled", status: 0 }, meta: {} }
			}
			if (attempt < maxAttempts) {
				await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 4000)))
				continue
			}
			return {
				success: false,
				error: { code: "NETWORK_ERROR", message: error instanceof Error ? error.message : "Network error", status: 0 },
				meta: {},
			}
		}
	}

	return { success: false, error: { code: "MAX_RETRIES_EXCEEDED", message: "Max retries exceeded", status: 0 }, meta: {} }
}

export const apiClient = {
	get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
		return request<T>(path, { ...options, method: "GET" })
	},
	post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
		return request<T>(path, {
			...options,
			method: "POST",
			body: body === undefined ? undefined : JSON.stringify(body),
		})
	},
	put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
		return request<T>(path, {
			...options,
			method: "PUT",
			body: body === undefined ? undefined : JSON.stringify(body),
		})
	},
	patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
		return request<T>(path, {
			...options,
			method: "PATCH",
			body: body === undefined ? undefined : JSON.stringify(body),
		})
	},
	del<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
		return request<T>(path, { ...options, method: "DELETE" })
	},
} as const

export type { ApiResponse, IApiError, IUser }

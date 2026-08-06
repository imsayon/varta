import type { Request, Response } from "express"

export interface ApiMeta {
	requestId?: string
	cursor?: string | null
	hasMore?: boolean
	total?: number
	page?: number
	limit?: number
	[key: string]: unknown
}

export interface ApiSuccessEnvelope<T> {
	success: true
	data: T
	meta: ApiMeta
}

export interface ApiErrorEnvelope {
	success: false
	error: {
		code: string
		message: string
		details?: Record<string, string[]> | unknown
	}
	meta: ApiMeta
}

export function sendSuccess<T>(
	req: Request,
	res: Response,
	data: T,
	statusCode = 200,
	meta: ApiMeta = {},
): Response {
	const requestId = String(req.requestId || req.id || res.getHeader("x-request-id") || "")
	const payload: ApiSuccessEnvelope<T> = {
		success: true,
		data,
		meta: {
			...(requestId ? { requestId } : {}),
			...meta,
		},
	}
	return res.status(statusCode).json(payload)
}

export function sendPaginated<T>(
	req: Request,
	res: Response,
	items: T[],
	cursor: string | null,
	hasMore: boolean,
	total?: number,
	statusCode = 200,
	extraMeta: ApiMeta = {},
): Response {
	const requestId = String(req.requestId || req.id || res.getHeader("x-request-id") || "")
	const meta: ApiMeta = {
		...(requestId ? { requestId } : {}),
		cursor,
		hasMore,
		...(total !== undefined ? { total } : {}),
		...extraMeta,
	}
	return res.status(statusCode).json({
		success: true,
		data: items,
		meta,
	})
}

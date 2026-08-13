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

export function requestMeta(req: Request, extra: ApiMeta = {}): ApiMeta {
	const requestId = String(req.requestId || req.id || "")
	return {
		...(requestId ? { requestId } : {}),
		...extra,
	}
}

export function sendSuccess<T>(
	req: Request,
	res: Response,
	data: T,
	statusCode = 200,
	meta: ApiMeta = {},
): Response {
	const payload: ApiSuccessEnvelope<T> = {
		success: true,
		data,
		meta: requestMeta(req, meta),
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
	const paginationMeta: ApiMeta = {
		cursor,
		hasMore,
		...(total !== undefined ? { total } : {}),
		...extraMeta,
	}
	return res.status(statusCode).json({
		success: true,
		data: items,
		meta: requestMeta(req, paginationMeta),
	})
}

export function sendError(
	req: Request,
	res: Response,
	statusCode: number,
	code: string,
	message: string,
	details?: Record<string, string[]> | unknown,
): Response {
	return res.status(statusCode).json({
		success: false,
		error: {
			code,
			message,
			...(details !== undefined ? { details } : {}),
		},
		meta: requestMeta(req),
	})
}

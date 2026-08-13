export interface PaginationQuery {
	cursor?: string
	page: number
	limit: number
	from?: Date
	to?: Date
	search?: string
}

export interface DecodedCursor {
	id: string
	createdAt: string
}

export function parsePaginationQuery(query: Record<string, unknown>): PaginationQuery {
	const limitRaw = Number(query.limit)
	const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20
	const pageRaw = Number(query.page)
	const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1

	let from: Date | undefined
	if (typeof query.from === "string" && query.from.length > 0) {
		const parsed = new Date(query.from)
		if (!Number.isNaN(parsed.getTime())) {
			from = parsed
		}
	}

	let to: Date | undefined
	if (typeof query.to === "string" && query.to.length > 0) {
		const parsed = new Date(query.to)
		if (!Number.isNaN(parsed.getTime())) {
			to = parsed
		}
	}

	const cursor = typeof query.cursor === "string" && query.cursor.trim().length > 0
		? query.cursor.trim()
		: undefined

	const search = typeof query.search === "string" && query.search.trim().length > 0
		? query.search.trim()
		: undefined

	const result: PaginationQuery = { page, limit }
	if (cursor) result.cursor = cursor
	if (from) result.from = from
	if (to) result.to = to
	if (search) result.search = search

	return result
}

export function encodeCursor(payload: DecodedCursor): string {
	return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

export function decodeCursor(cursorString?: string): DecodedCursor | null {
	if (!cursorString) return null
	try {
		const decoded = Buffer.from(cursorString, "base64url").toString("utf8")
		const parsed = JSON.parse(decoded)
		if (parsed && typeof parsed.id === "string" && typeof parsed.createdAt === "string") {
			return parsed as DecodedCursor
		}
		return null
	} catch {
		return null
	}
}

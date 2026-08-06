import type { NextFunction, Request, Response } from "express"
import { env } from "@/common/config/env.ts"
import { ForbiddenError } from "@/common/errors/app-error.ts"

const THIRTY_DAYS_IN_MS = 1000 * 60 * 60 * 24 * 30

const REFRESH_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: env.NODE_ENV === "production",
	sameSite:
		env.NODE_ENV === "production" ? ("none" as const) : ("strict" as const),
	path: "/",
	maxAge: THIRTY_DAYS_IN_MS,
}

export function setRefreshTokenCookie(res: Response, token: string): void {
	res.cookie("refreshToken", token, REFRESH_COOKIE_OPTIONS)
}

export function clearRefreshTokenCookie(res: Response): void {
	res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS)
}

export function validateSameOriginOrCsrf(req: {
	headers: Record<string, string | string[] | undefined>
}): boolean {
	const cookieHeader = req.headers.cookie
	const hasRefreshCookie =
		typeof cookieHeader === "string" && /(?:^|;\s*)refreshToken=/.test(cookieHeader)
	const source = req.headers.origin ?? req.headers.referer
	if (!source) return !hasRefreshCookie
	const value = Array.isArray(source) ? source[0] : source
	if (!value) return false
	try {
		const requestOrigin = new URL(value).origin
		const configured = [env.CLIENT_URL, env.CORS_ORIGIN]
			.flatMap((entry) => entry.split(","))
			.map((entry) => entry.trim())
			.filter((entry) => entry && entry !== "*")
			.map((entry) => new URL(entry).origin)
		return configured.includes(requestOrigin)
	} catch {
		return false
	}
}

export function requireTrustedOrigin(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	if (!validateSameOriginOrCsrf(req)) {
		next(new ForbiddenError("Untrusted request origin"))
		return
	}
	next()
}

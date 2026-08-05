import type { Response } from "express"
import { env } from "@/common/config/env.ts"

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
	const origin = req.headers["origin"] || req.headers["referer"]
	if (!origin) return true // Non-browser clients without cookie state
	const originStr = Array.isArray(origin) ? origin[0] : origin
	const allowedOrigin = env.CORS_ORIGIN || env.CLIENT_URL
	if (originStr && allowedOrigin && allowedOrigin !== "*") {
		return originStr.startsWith(allowedOrigin)
	}
	return true
}

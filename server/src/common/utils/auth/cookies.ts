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

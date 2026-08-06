import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const publicAuthRoutes = [
	"/login",
	"/signup",
	"/forgot-password",
	"/reset-password",
	"/verify-email",
]

const protectedRoutes = [
	"/analytics",
	"/api-keys",
	"/subscribers",
	"/templates",
	"/rules",
	"/routing-rules",
	"/settings",
	"/dashboard",
	"/studio",
	"/notifications",
]

export function validateRedirectUrl(urlParam?: string | null): string {
	if (!urlParam) return "/analytics"
	const trimmed = urlParam.trim()
	if (
		trimmed.startsWith("/") &&
		!trimmed.startsWith("//") &&
		!trimmed.startsWith("/\\") &&
		!trimmed.includes(":")
	) {
		return trimmed
	}
	return "/analytics"
}

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl

	// Skip proxy for API routes, Next.js static assets, and files with extensions
	if (
		pathname.startsWith("/api") ||
		pathname.startsWith("/_next") ||
		pathname.includes(".")
	) {
		return NextResponse.next()
	}

	const hasRefreshToken = request.cookies.has("refreshToken")

	// If trying to access public auth routes while logged in
	if (publicAuthRoutes.some((route) => pathname.startsWith(route))) {
		const isVerificationFlow = pathname.startsWith("/verify-email") || pathname.startsWith("/reset-password")
		if (hasRefreshToken && !isVerificationFlow) {
			const redirectTarget = validateRedirectUrl(request.nextUrl.searchParams.get("from"))
			return NextResponse.redirect(new URL(redirectTarget, request.url))
		}
		return NextResponse.next()
	}

	// If trying to access protected routes while NOT logged in
	const isProtectedRoute = protectedRoutes.some((route) =>
		pathname.startsWith(route),
	)

	if (isProtectedRoute && !hasRefreshToken) {
		const loginUrl = new URL("/login", request.url)
		loginUrl.searchParams.set("from", pathname)
		return NextResponse.redirect(loginUrl)
	}

	return NextResponse.next()
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico).*)",
	],
}

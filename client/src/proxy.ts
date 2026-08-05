import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const publicRoutes = ["/login", "/signup"]
const protectedRoutes = [
	"/analytics",
	"/api-keys",
	"/subscribers",
	"/templates",
	"/rules",
	"/settings",
	"/dashboard",
]

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl

	// Skip proxy for API routes and static assets
	if (
		pathname.startsWith("/api") ||
		pathname.startsWith("/_next") ||
		pathname.includes(".")
	) {
		return NextResponse.next()
	}

	const hasRefreshToken = request.cookies.has("refreshToken")

	// If trying to access public auth routes while already logged in
	if (publicRoutes.some((route) => pathname.startsWith(route))) {
        if (hasRefreshToken) {
			return NextResponse.redirect(new URL("/settings", request.url))
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

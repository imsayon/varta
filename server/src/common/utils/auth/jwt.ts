import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import { env } from "@/common/config/env.ts"

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET)
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET)

export interface AccessTokenPayload extends JWTPayload {
	sub: string
	sessionId: string
	workspaceId: string
}

export interface RefreshTokenPayload extends JWTPayload {
	sub: string
	sessionId: string
}

// short-lived token carrying user context
export async function generateAccessToken(
	payload: Omit<AccessTokenPayload, "iat" | "exp">,
): Promise<string> {
	return new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
		.sign(accessSecret)
}

// long-lived token for silent refresh
export async function generateRefreshToken(
	payload: Omit<RefreshTokenPayload, "iat" | "exp">,
): Promise<string> {
	return new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(env.JWT_REFRESH_EXPIRES_IN)
		.sign(refreshSecret)
}

export async function verifyAccessToken(token: string) {
	return jwtVerify(token, accessSecret)
}

export async function verifyRefreshToken(token: string) {
	return jwtVerify(token, refreshSecret)
}

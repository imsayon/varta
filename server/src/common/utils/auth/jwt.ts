import crypto from "node:crypto"
import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import { env } from "@/common/config/env.ts"

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET)
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET)

export interface AccessTokenPayload extends JWTPayload {
	sub: string
	sessionId: string
	workspaceId: string
	type: "access"
}

export interface RefreshTokenPayload extends JWTPayload {
	sub: string
	sessionId: string
	type: "refresh"
	jti: string
}

export const ACCESS_TOKEN_LIFETIME = "15m" as const

// short-lived token carrying user context
export async function generateAccessToken(
	payload: Omit<AccessTokenPayload, "iat" | "exp" | "type" | "jti">,
): Promise<string> {
	return new SignJWT({ ...payload, type: "access" })
		.setProtectedHeader({ alg: "HS256" })
		.setJti(crypto.randomUUID())
		.setIssuer("varta")
		.setAudience("varta-api")
		.setIssuedAt()
		.setExpirationTime(ACCESS_TOKEN_LIFETIME)
		.sign(accessSecret)
}

// long-lived token for silent refresh
export async function generateRefreshToken(
	payload: Omit<RefreshTokenPayload, "iat" | "exp" | "type">,
): Promise<string> {
	return new SignJWT({ ...payload, type: "refresh" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer("varta")
		.setAudience("varta-refresh")
		.setIssuedAt()
		.setExpirationTime(env.JWT_REFRESH_EXPIRES_IN)
		.sign(refreshSecret)
}

export async function verifyAccessToken(token: string) {
	return jwtVerify(token, accessSecret, {
		issuer: "varta",
		audience: "varta-api",
		algorithms: ["HS256"],
	})
}

export async function verifyRefreshToken(token: string) {
	return jwtVerify(token, refreshSecret, {
		issuer: "varta",
		audience: "varta-refresh",
		algorithms: ["HS256"],
	})
}

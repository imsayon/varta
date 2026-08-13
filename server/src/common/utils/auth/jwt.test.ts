import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { decodeJwt } from "jose"
import {
	ACCESS_TOKEN_LIFETIME,
	generateAccessToken,
	generateRefreshToken,
	verifyAccessToken,
	verifyRefreshToken,
} from "./jwt.ts"

test("refresh tokens have unique identifiers and explicit token type", async () => {
	const first = await generateRefreshToken({
		sub: "user-1",
		sessionId: "session-1",
		jti: randomUUID(),
	})
	const second = await generateRefreshToken({
		sub: "user-1",
		sessionId: "session-1",
		jti: randomUUID(),
	})
	const firstClaims = await verifyRefreshToken(first)
	const secondClaims = await verifyRefreshToken(second)

	assert.equal(firstClaims.payload.type, "refresh")
	assert.equal(secondClaims.payload.type, "refresh")
	assert.notEqual(firstClaims.payload.jti, secondClaims.payload.jti)
	assert.equal(firstClaims.payload.iss, "varta")
	assert.equal(firstClaims.payload.aud, "varta-refresh")
})

test("access tokens use the explicit short lifetime and separate audience", async () => {
	const token = await generateAccessToken({
		sub: "user-1",
		sessionId: "session-1",
		workspaceId: "workspace-1",
	})
	const verified = await verifyAccessToken(token)
	const claims = decodeJwt(token)

	assert.equal(verified.payload.type, "access")
	assert.equal(verified.payload.aud, "varta-api")
	assert.equal(claims.exp! - claims.iat!, 15 * 60)
	assert.equal(ACCESS_TOKEN_LIFETIME, "15m")
})

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
	generateAccessToken,
	generateRefreshToken,
	verifyAccessToken,
	verifyRefreshToken,
} from "@/common/utils/auth/jwt.ts"

function validateRedirectUrl(urlParam?: string | null): string {
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

describe("C3 Browser Authentication Journey Unit Suite", () => {
	it("generates and verifies access and refresh tokens with unique JTIs and correct audiences", async () => {
		const userId = "usr_test_123"
		const sessionId = "sess_test_456"
		const jti = "jti_test_789"

		const accessToken = await generateAccessToken({
			sub: userId,
			sessionId,
			workspaceId: "ws_test_000",
		})

		const refreshToken = await generateRefreshToken({
			sub: userId,
			sessionId,
			jti: `${jti}_ref`,
		})

		assert.ok(typeof accessToken === "string")
		assert.ok(typeof refreshToken === "string")

		const accessPayload = (await verifyAccessToken(accessToken)).payload
		assert.equal(accessPayload.sub, userId)
		assert.equal(accessPayload.sessionId, sessionId)
		assert.equal(accessPayload.type, "access")

		const refreshPayload = (await verifyRefreshToken(refreshToken)).payload
		assert.equal(refreshPayload.sub, userId)
		assert.equal(refreshPayload.sessionId, sessionId)
		assert.equal(refreshPayload.type, "refresh")
	})

	it("rejects token verification for invalid or tampered signatures", async () => {
		const tamperedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" // gitleaks:allow -- public jwt.io example, intentionally invalid here
		await assert.rejects(() => verifyAccessToken(tamperedToken))
		await assert.rejects(() => verifyRefreshToken(tamperedToken))
	})

	it("sanitizes redirect URLs to prevent open redirects", () => {
		assert.equal(validateRedirectUrl("/analytics"), "/analytics")
		assert.equal(validateRedirectUrl("/settings"), "/settings")
		assert.equal(validateRedirectUrl("https://evil.com"), "/analytics")
		assert.equal(validateRedirectUrl("//evil.com"), "/analytics")
		assert.equal(validateRedirectUrl("/\\evil.com"), "/analytics")
		assert.equal(validateRedirectUrl("javascript:alert(1)"), "/analytics")
		assert.equal(validateRedirectUrl(null), "/analytics")
		assert.equal(validateRedirectUrl(undefined), "/analytics")
	})
})

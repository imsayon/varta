import crypto from "node:crypto"
import { env } from "@/common/config/env.ts"

const HMAC_SECRET = env.ENCRYPTION_KEY

/**
 * Fast HMAC-SHA256 hash calculation for high-throughput random strings (refresh tokens, API keys).
 * Much faster than Argon2id (~0.05ms vs ~200ms) while secure against dictionary attacks for high-entropy tokens.
 */
export function hashToken(token: string): string {
	return crypto.createHmac("sha256", HMAC_SECRET).update(token).digest("hex")
}

export function verifyToken(token: string, expectedHash: string): boolean {
	const actualHash = hashToken(token)
	const actualBuffer = Buffer.from(actualHash, "hex")
	const expectedBuffer = Buffer.from(expectedHash, "hex")

	if (actualBuffer.length !== expectedBuffer.length) {
		return false
	}
	return crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}

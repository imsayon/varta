import { createHash, randomBytes } from "node:crypto"

export function generateIdempotencyKey(...parts: string[]): string {
	return createHash("sha256").update(parts.join(":")).digest("hex")
}

export function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
	const prefix = `vt_live_${randomBytes(4).toString("hex")}`
	const secret = randomBytes(24).toString("hex")
	const fullKey = `${prefix}_${secret}`
	const hash = createHash("sha256").update(fullKey).digest("hex")
	return { fullKey, prefix, hash }
}

export function hashApiKey(key: string): string {
	return createHash("sha256").update(key).digest("hex")
}

export function generateToken(): string {
	return randomBytes(32).toString("hex")
}

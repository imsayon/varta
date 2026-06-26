import crypto from "node:crypto"

const TOKEN_BYTES = 32

// generate a cryptographically secure random hex token
export function generateSecureToken(): string {
	return crypto.randomBytes(TOKEN_BYTES).toString("hex")
}

// one-way sha256 hash for storing tokens safely in DB
export function hashToken(token: string): string {
	return crypto.createHash("sha256").update(token).digest("hex")
}

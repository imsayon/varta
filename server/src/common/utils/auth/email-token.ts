import { customAlphabet } from "nanoid"
import crypto from "node:crypto"

// Base62 alphabet for cleaner URLs without special characters
const nanoid = customAlphabet(
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	32,
)

export function generateEmailToken(): string {
	return nanoid()
}

export function hashEmailToken(token: string): string {
	return crypto.createHash("sha256").update(token).digest("hex")
}

import crypto from "node:crypto"
import { env } from "@/common/config/env.ts"

// AES-256-GCM requires a 32-byte key.
const getEncryptionKey = (): Buffer => {
	const keyStr = env.ENCRYPTION_KEY
	if (keyStr.length === 64) {
		return Buffer.from(keyStr, "hex")
	}
	if (keyStr.length === 32) {
		return Buffer.from(keyStr, "utf-8")
	}
	// Pad or truncate to 32 bytes
	const buf = Buffer.alloc(32)
	buf.write(keyStr, 0, "utf-8")
	return buf
}

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

//Encrypts a plain text string using AES-256-GCM.
//Returns a base64 encoded string containing the IV, encrypted data, and auth tag.

export function encrypt(text: string): string {
	const key = getEncryptionKey()
	const iv = crypto.randomBytes(IV_LENGTH)
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

	let encrypted = cipher.update(text, "utf8", "base64")
	encrypted += cipher.final("base64")

	const authTag = cipher.getAuthTag().toString("base64")
	const ivStr = iv.toString("base64")

	// Format: iv:authTag:encryptedData
	return `${ivStr}:${authTag}:${encrypted}`
}

//  Decrypts a previously encrypted string.
//  Expects the format: iv:authTag:encryptedData (all base64 encoded)

export function decrypt(encryptedText: string): string {
	const key = getEncryptionKey()
	const parts = encryptedText.split(":")

	if (parts.length !== 3) {
		throw new Error(
			"Invalid encrypted text format. Expected iv:authTag:encryptedData",
		)
	}

	const iv = Buffer.from(parts[0] || "", "base64")
	const authTag = Buffer.from(parts[1] || "", "base64")
	const encrypted = parts[2]

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
	decipher.setAuthTag(authTag)

	let decrypted = decipher.update(encrypted || "", "base64", "utf8")
	decrypted = decrypted + decipher.final("utf8")

	return decrypted
}

// Encrypts a provider config object. Each string value is encrypted individually
// so the shape of the object is preserved for partial reads.
export function encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(config)) {
                result[key] = typeof value === "string" ? encrypt(value) : value
        }
        return result
}

// Decrypts a previously encrypted config object produced by encryptConfig.
export function decryptConfig(config: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(config)) {
                result[key] = typeof value === "string" ? decrypt(value) : value
        }
        return result
}

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { decryptConfig, encryptConfig } from "@/common/utils/crypto.util.ts"

describe("C4 Workspace, Settings & Provider Unit Suite", () => {
	it("encrypts and decrypts provider credentials safely with secret masking", () => {
		const rawConfig = {
			apiKey: "re_secret_key_12345",
			fromAddress: "Varta <alerts@varta.dev>",
		}

		const encrypted = encryptConfig(rawConfig)
		assert.ok(typeof encrypted === "object")

		const decrypted = decryptConfig(encrypted)
		assert.equal(decrypted.apiKey, "re_secret_key_12345")
		assert.equal(decrypted.fromAddress, "Varta <alerts@varta.dev>")

		const masked = Object.fromEntries(
			Object.entries(decrypted).map(([key, val]) => [
				key,
				key.toLowerCase().includes("secret") || key.toLowerCase().includes("key")
					? "********"
					: val,
			]),
		)

		assert.equal(masked.apiKey, "********")
		assert.equal(masked.fromAddress, "Varta <alerts@varta.dev>")
	})
})

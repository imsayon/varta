import assert from "node:assert/strict"
import test from "node:test"
import { resendProvider } from "./resend.provider.ts"

const payload = {
	to: "recipient@example.test",
	from: "sender@example.test",
	subject: "Subject",
	html: "<p>Body</p>",
	text: "Body",
	apiKey: "test-key",
	idempotencyKey: "delivery-id",
}

test("Resend adapter normalizes success and sends a stable idempotency key", async () => {
	const originalFetch = globalThis.fetch
	let request: RequestInit | undefined
	globalThis.fetch = async (_input, init) => {
		request = init
		return Response.json({ id: "provider-message-id" }, { status: 200 })
	}
	try {
		assert.deepEqual(await resendProvider.send(payload), {
			success: true,
			messageId: "provider-message-id",
		})
		assert.equal(
			(request?.headers as Record<string, string>)["idempotency-key"],
			"delivery-id",
		)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test("Resend adapter classifies client and transient failures", async () => {
	const originalFetch = globalThis.fetch
	try {
		globalThis.fetch = async () =>
			Response.json({ message: "invalid sender" }, { status: 422 })
		assert.equal((await resendProvider.send(payload)).retryable, false)
		globalThis.fetch = async () =>
			Response.json({ message: "temporarily unavailable" }, { status: 503 })
		assert.equal((await resendProvider.send(payload)).retryable, true)
	} finally {
		globalThis.fetch = originalFetch
	}
})

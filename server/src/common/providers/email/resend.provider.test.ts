import assert from "node:assert/strict"
import test from "node:test"
import { resendProvider } from "./resend.provider.ts"

const payload = { to: "recipient@example.test", from: "sender@example.test", subject: "Synthetic",
	html: "<p>synthetic</p>", apiKey: "synthetic-secret-do-not-echo", idempotencyKey: "delivery-synthetic" }

test("Resend distinguishes conflicts, validates IDs and preserves HTTP retry classification without exposing errors", async (t) => {
	for (const [status, body, retryable] of [
		[409, { name: "concurrent_idempotent_requests", message: payload.apiKey }, true],
		[409, { name: "invalid_idempotent_request", message: payload.apiKey }, false],
		[409, { name: "unknown" }, false], [409, { name: 1 }, false], [409, null, false],
		[400, {}, false], [401, {}, false], [403, {}, false], [404, {}, false],
		[408, {}, true], [422, {}, false], [429, {}, true], [500, {}, true], [503, {}, true],
	] as const) {
		t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
			assert.equal(_url, "https://api.resend.com/emails")
			assert.equal(new Headers(options.headers).get("idempotency-key"), payload.idempotencyKey)
			assert.equal(new Headers(options.headers).get("authorization"), `Bearer ${payload.apiKey}`)
			assert.equal(options.method, "POST")
			assert.deepEqual(JSON.parse(String(options.body)), { from: payload.from, to: [payload.to], subject: payload.subject, html: payload.html, text: "" })
			return Response.json(body, { status })
		})
		const result = await resendProvider.send(payload)
		assert.equal(result.success, false)
		assert.equal(result.retryable, retryable, `HTTP ${status} ${JSON.stringify(body)}`)
		assert.ok(!result.error?.includes(payload.apiKey))
		t.mock.restoreAll()
	}
	for (const body of ["not-json", "null", '[]', '{"id":5}', '{"id":""}']) {
		t.mock.method(globalThis, "fetch", async () => new Response(body, { status: 200 }))
		assert.deepEqual(await resendProvider.send(payload), { success: false, error: "Resend response did not include a message ID", retryable: true })
		t.mock.restoreAll()
	}
	t.mock.method(globalThis, "fetch", async () => new Response("not-json", { status: 409 }))
	assert.equal((await resendProvider.send(payload)).retryable, false)
	t.mock.restoreAll()
	t.mock.method(globalThis, "fetch", async () => Response.json({ id: "msg_synthetic" }))
	assert.deepEqual(await resendProvider.send(payload), { success: true, messageId: "msg_synthetic" })
	t.mock.restoreAll()
	t.mock.method(globalThis, "fetch", async () => { throw new Error(`transport ${payload.apiKey}`) })
	const failed = await resendProvider.send(payload)
	assert.equal(failed.retryable, true)
	assert.ok(!failed.error?.includes(payload.apiKey))
})

test("Resend bounds fetch and error-body stalls with its existing ten-second timeout", async (t) => {
	for (const phase of ["fetch", "body"] as const) {
		t.mock.timers.enable({ apis: ["setTimeout"] })
		let signal: AbortSignal | undefined
		t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
			signal = options.signal as AbortSignal
			const stalled = () => new Promise<never>((_resolve, reject) => {
				signal!.addEventListener("abort", () => reject(signal!.reason), { once: true })
			})
			if (phase === "fetch") return stalled()
			return { ok: false, status: 409, json: stalled } as unknown as Response
		})
		const pending = resendProvider.send(payload)
		await Promise.resolve()
		t.mock.timers.tick(10_000)
		const result = await pending
		assert.equal(signal?.aborted, true)
		assert.equal(result.success, false)
		assert.equal(result.retryable, true, `${phase} timeout is retryable`)
		t.mock.restoreAll()
		t.mock.timers.reset()
	}
})

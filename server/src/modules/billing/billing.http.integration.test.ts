import assert from "node:assert/strict"
import crypto from "node:crypto"
import test from "node:test"

const enabled = process.env.RUN_BILLING_HTTP_TESTS === "true"

test("Razorpay HTTP webhook preserves exact bytes, deduplicates event IDs, and rejects tampering", { skip: !enabled }, async () => {
	const [{ app }, { prisma, disconnectDatabase }, { closeQueues }, { connectRedis, disconnectRedis }] = await Promise.all([
		import("@/app.ts"),
		import("@/infra/database/prisma.ts"),
		import("@/infra/queues/queue.factory.ts"),
		import("@/infra/redis/redis.connection.ts"),
	])
	await connectRedis()
	const server = app.listen(0, "127.0.0.1")
	await new Promise<void>((resolve) => server.once("listening", resolve))
	const address = server.address()
	if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port")
	const origin = `http://127.0.0.1:${address.port}`
	const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ""
	const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS ?? ""
	const eventId = `evt_${crypto.randomUUID()}`
	const savedEventIds = [eventId]
	const rawBody = JSON.stringify({ event: "subscription.activated", created_at: 2_000, payload: {} })
	const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
	try {
		const send = (body: string, id: string, signed = signature) => fetch(`${origin}/api/v1/webhooks/razorpay`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Razorpay-Event-Id": id,
				"X-Razorpay-Signature": signed,
			},
			body,
		})
		const accepted = await send(rawBody, eventId)
		assert.equal(accepted.status, 202)
		const duplicates = await Promise.all(Array.from({ length: 8 }, () => send(rawBody, eventId)))
		assert.ok(duplicates.every(({ status }) => status === 202))
		assert.equal(await prisma.billingWebhookEvent.count({ where: { eventId } }), 1)

		const tamperedId = `evt_${crypto.randomUUID()}`
		const tampered = await send(`${rawBody} `, tamperedId)
		assert.equal(tampered.status, 400)
		assert.equal(await prisma.billingWebhookEvent.count({ where: { eventId: tamperedId } }), 0)

		const rotatedId = `evt_${crypto.randomUUID()}`
		savedEventIds.push(rotatedId)
		const rotatedSignature = crypto.createHmac("sha256", previousSecret).update(rawBody).digest("hex")
		const rotated = await send(rawBody, rotatedId, rotatedSignature)
		assert.equal(rotated.status, 202)
		assert.equal(await prisma.billingWebhookEvent.count({ where: { eventId: rotatedId } }), 1)

		const invalidJson = "{not-json"
		const invalidJsonId = `evt_${crypto.randomUUID()}`
		const invalidJsonSignature = crypto.createHmac("sha256", secret).update(invalidJson).digest("hex")
		assert.equal((await send(invalidJson, invalidJsonId, invalidJsonSignature)).status, 400)
		assert.equal(await prisma.billingWebhookEvent.count({ where: { eventId: invalidJsonId } }), 0)

		const oversizedBody = JSON.stringify({ event: "subscription.activated", payload: {}, padding: "x".repeat(257 * 1024) })
		const oversizedId = `evt_${crypto.randomUUID()}`
		const oversizedSignature = crypto.createHmac("sha256", secret).update(oversizedBody).digest("hex")
		assert.equal((await send(oversizedBody, oversizedId, oversizedSignature)).status, 413)
		assert.equal(await prisma.billingWebhookEvent.count({ where: { eventId: oversizedId } }), 0)
	} finally {
		await prisma.billingWebhookEvent.deleteMany({ where: { eventId: { in: savedEventIds } } })
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
		await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
	}
})

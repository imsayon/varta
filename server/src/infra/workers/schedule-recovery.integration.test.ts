import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"

test("running workers restore recurring schedules lost from Redis", {
	skip: process.env.RUN_NOTIFICATION_QUEUE_TESTS !== "true", timeout: 20_000,
}, async (t) => {
	process.env.REDIS_QUEUE_PREFIX = `schedule_test_${randomUUID()}`
	const { connectRedis, disconnectRedis } = await import("@/infra/redis/redis.connection.ts")
	const { disconnectDatabase } = await import("@/infra/database/prisma.ts")
	const { closeQueues } = await import("@/infra/queues/queue.factory.ts")
	const { startWorkers, stopWorkers } = await import("./worker.bootstrap.ts")
	const { outboxQueue, reconciliationQueue, billingQueue } = await import("@/infra/queues/queues.ts")
	const queues = [outboxQueue, reconciliationQueue, billingQueue]
	const original = globalThis.setInterval
	let refresh: (() => void) | undefined
	t.mock.method(globalThis, "setInterval", (callback: () => void, delay?: number) => {
		if (delay === 300_000) refresh = callback
		return original(callback, delay)
	})
	await connectRedis()
	try {
		await startWorkers()
		assert.ok(refresh, "the running process must own a restoration timer independent of Redis")
		const counts = await Promise.all(queues.map(async queue => {
			const schedules = await queue.getJobSchedulers()
			assert.ok(schedules.length > 0)
			for (const schedule of schedules) await queue.removeJobScheduler(schedule.key)
			assert.equal((await queue.getJobSchedulers()).length, 0)
			return schedules.length
		}))
		refresh()
		for (let i = 0; i < 100; i++) {
			const restored = await Promise.all(queues.map(async queue => (await queue.getJobSchedulers()).length))
			if (restored.every((count, index) => count === counts[index])) break
			await new Promise(resolve => setTimeout(resolve, 20))
		}
		assert.deepEqual(await Promise.all(queues.map(async queue => (await queue.getJobSchedulers()).length)), counts)
	} finally {
		await stopWorkers()
		for (const queue of queues) await queue.obliterate({ force: true })
		await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
	}
})

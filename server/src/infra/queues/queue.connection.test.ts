import assert from "node:assert/strict"
import test from "node:test"
import { createQueue, closeQueues } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"
import { createQueueConnection, getQueuePrefix } from "./queue.connection.ts"

test("BullMQ Redis connection enables TLS for rediss URLs", () => {
	const connection = createQueueConnection({
		redisUrl: "rediss://queue-user:p%40ss@example.test:6380",
		serviceName: "varta-test",
	})

	const options = connection as {
		host: string
		port: number
		username: string
		password: string
		tls: object
		connectionName: string
	}
	assert.equal(options.host, "example.test")
	assert.equal(options.port, 6380)
	assert.equal(options.username, "queue-user")
	assert.equal(options.password, "p@ss")
	assert.deepEqual(options.tls, {})
	assert.equal(options.connectionName, "varta-test-bullmq")
	assert.equal((connection as { url: string }).url, "rediss://queue-user:p%40ss@example.test:6380")
})

test("BullMQ queues and workers share the configured environment prefix", async () => {
	const queue = createQueue(QueueNames.OUTBOX)
	const client = await queue.getBackend().client
	try {
		assert.equal(queue.opts.prefix, getQueuePrefix())
		assert.ok(getQueuePrefix().length > 0)
	} finally {
		await closeQueues()
		assert.equal(client.status, "end")
	}
})

test("BullMQ Redis connection rejects unsupported URL protocols", () => {
	assert.throws(
		() => createQueueConnection({ redisUrl: "http://example.test", serviceName: "varta-test" }),
		/REDIS_URL must use redis:\/\/ or rediss:\/\//,
	)
})

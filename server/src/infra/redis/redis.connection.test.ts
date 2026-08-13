import assert from "node:assert/strict"
import test from "node:test"
import {
	connectRedis,
	disconnectRedis,
	redis,
	redisReconnectStrategy,
} from "./redis.connection.ts"

test("Redis reconnect strategy backs off through the final retry", () => {
	assert.equal(redisReconnectStrategy(0), 200)
	assert.equal(redisReconnectStrategy(10), 2_200)
})

test("Redis reconnect strategy stops after the terminal retry", () => {
	assert.equal(redisReconnectStrategy(11), false)
	redis.emit("reconnecting")
	redis.emit("error", new Error("test Redis error"))
})

test("Redis lifecycle connects, pings, and disconnects idempotently", async () => {
	try {
		await disconnectRedis()

		await Promise.all([connectRedis(), connectRedis()])
		assert.equal(redis.isOpen, true)
		assert.equal(redis.isReady, true)
		assert.equal(await redis.ping(), "PONG")

		await connectRedis()
		assert.equal(redis.isReady, true)
	} finally {
		await disconnectRedis()
		await disconnectRedis()
	}

	assert.equal(redis.isOpen, false)
	assert.equal(redis.isReady, false)
})

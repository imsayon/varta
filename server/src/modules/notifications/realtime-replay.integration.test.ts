import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { once } from "node:events"
import { createServer } from "node:http"
import test from "node:test"
import { WebSocket } from "ws"
import { prisma, disconnectDatabase } from "@/infra/database/prisma.ts"
import { generateSubscriberWebSocketToken } from "@/common/utils/auth/websocket-token.ts"

test("realtime drains more than 50 messages after reconnect without acknowledging another tenant or marking read", {
	skip: process.env.RUN_NOTIFICATION_QUEUE_TESTS !== "true", timeout: 20_000,
}, async () => {
	const { startWebSocketServer, stopWebSocketServer } = await import("@/infra/realtime/websocket.server.ts")
	const { connectRedis, disconnectRedis } = await import("@/infra/redis/redis.connection.ts")
	await connectRedis()
	const server = createServer()
	await startWebSocketServer(server)
	server.listen(0, "127.0.0.1")
	await once(server, "listening")
	const workspace = await prisma.workspace.create({ data: { name: "Replay", slug: randomUUID() } })
	const other = await prisma.workspace.create({ data: { name: "Other replay", slug: randomUUID() } })
	let socket: WebSocket | undefined
	try {
		const template = await prisma.template.create({ data: { workspaceId: workspace.id, name: "Replay", channels: {} } })
		const subscriber = await prisma.subscriber.create({ data: { workspaceId: workspace.id, externalId: "reviewer" } })
		const ids: string[] = []
		for (let i = 0; i < 63; i++) {
			const notification = await prisma.notification.create({ data: { workspaceId: workspace.id, templateId: template.id, subscriberId: subscriber.id,
				idempotencyKey: randomUUID(), channels: ["IN_APP"], pendingInApp: { create: { workspaceId: workspace.id, subscriberId: subscriber.id, content: { title: `Message ${i}` } } } } })
			ids.push(notification.id)
		}
		const otherSubscriber = await prisma.subscriber.create({ data: { workspaceId: other.id, externalId: "reviewer" } })
		const otherTemplate = await prisma.template.create({ data: { workspaceId: other.id, name: "Other", channels: {} } })
		const otherNotification = await prisma.notification.create({ data: { workspaceId: other.id, templateId: otherTemplate.id, subscriberId: otherSubscriber.id,
			idempotencyKey: randomUUID(), channels: ["IN_APP"], pendingInApp: { create: { workspaceId: other.id, subscriberId: otherSubscriber.id, content: { title: "Private" } } } } })
		const token = await generateSubscriberWebSocketToken({ sub: subscriber.id, workspaceId: workspace.id })
		const url = `ws://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}/ws?token=${token}`
		const seen = new Set<string>()
		const receive = (ack: boolean, count: number) => new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`Replay received ${seen.size}, expected ${count}`)), 8000)
			socket = new WebSocket(url)
			socket.on("error", reject)
			socket.on("message", raw => {
				const message = JSON.parse(raw.toString())
				if (message.type !== "pending_flush") return
				assert.ok(ids.includes(message.data.id), "only this subscriber's messages are replayed")
				seen.add(message.data.id)
				if (ack) {
					socket!.send(JSON.stringify({ type: "ack", notificationId: message.data.id }))
					socket!.send(JSON.stringify({ type: "ack", notificationId: message.data.id }))
				}
				if (seen.size === count) { clearTimeout(timer); resolve() }
			})
		})
		await receive(false, 50)
		const closed = once(socket!, "close"); socket!.close(); await closed
		assert.equal(await prisma.pendingInApp.count({ where: { workspaceId: workspace.id, deliveredAt: null } }), 63)
		seen.clear()
		await receive(true, 63)
		// ACK persistence is asynchronous; wait within a bounded deadline.
		for (let i = 0; i < 100; i++) {
			if (!await prisma.pendingInApp.count({ where: { workspaceId: workspace.id, deliveredAt: null } })) break
			await new Promise(resolve => setTimeout(resolve, 20))
		}
		assert.equal(await prisma.pendingInApp.count({ where: { workspaceId: workspace.id, deliveredAt: null } }), 0)
		assert.equal(await prisma.notification.count({ where: { workspaceId: workspace.id, readAt: { not: null } } }), 0)
		assert.equal((await prisma.pendingInApp.findUniqueOrThrow({ where: { notificationId: otherNotification.id } })).deliveredAt, null)
	} finally {
		if (socket && socket.readyState !== WebSocket.CLOSED) { const closed = once(socket, "close"); socket.close(); await closed }
		await stopWebSocketServer(server)
		await new Promise<void>(resolve => server.close(() => resolve()))
		await prisma.workspace.deleteMany({ where: { id: { in: [workspace.id, other.id] } } })
		await Promise.allSettled([disconnectRedis(), disconnectDatabase()])
	}
})

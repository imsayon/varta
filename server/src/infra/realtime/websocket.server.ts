import type { IncomingMessage, Server } from "node:http"
import { WebSocket, WebSocketServer } from "ws"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import { logger } from "@/infra/observability/logger.ts"
import { activeWebSockets } from "@/infra/observability/metrics.ts"
import {
	verifySubscriberWebSocketToken,
	type SubscriberWebSocketTokenPayload,
} from "@/common/utils/auth/websocket-token.ts"
import {
	REALTIME_CHANNEL,
	realtimeConnectionKey,
	type InAppDeliveryEvent,
} from "./realtime.events.ts"

const HEARTBEAT_INTERVAL_MS = 30_000
const PRESENCE_TTL_SECONDS = 35

type Connection = {
	socket: WebSocket
	workspaceId: string
	subscriberId: string
	connectionId: string
	key: string
	alive: boolean
}

const webSocketServer = new WebSocketServer({ noServer: true })
const pubsub = redis.duplicate()
const connections = new Map<string, Connection>()
const socketTokens = new WeakMap<WebSocket, SubscriberWebSocketTokenPayload>()
let heartbeat: NodeJS.Timeout | undefined
let upgradeHandler:
	| ((
			request: IncomingMessage,
			socket: import("node:net").Socket,
			head: Buffer,
	  ) => void)
	| undefined

function send(socket: WebSocket, message: unknown): boolean {
	if (socket.readyState !== WebSocket.OPEN) return false
	socket.send(JSON.stringify(message))
	return true
}

async function flushPending(connection: Connection): Promise<void> {
	const pending = await prisma.pendingInApp.findMany({
		where: {
			workspaceId: connection.workspaceId,
			subscriberId: connection.subscriberId,
			deliveredAt: null,
		},
		take: 50,
		orderBy: { createdAt: "asc" },
		select: {
			id: true,
			notificationId: true,
			content: true,
			createdAt: true,
		},
	})

	for (const item of pending) {
		if (
			!send(connection.socket, {
				type: "pending_flush",
				data: {
					id: item.notificationId,
					...(item.content as Record<string, unknown>),
					createdAt: item.createdAt.toISOString(),
				},
			})
		)
			break
	}
}

async function deliverLive(event: InAppDeliveryEvent): Promise<void> {
	for (const connection of connections.values()) {
		if (
			connection.workspaceId !== event.workspaceId ||
			connection.subscriberId !== event.subscriberId
		)
			continue
		send(connection.socket, {
			type: "notification",
			data: {
				id: event.notificationId,
				...event.content,
				createdAt: new Date().toISOString(),
			},
		})
	}
}

function parseClientMessage(
	raw: Buffer,
): { type?: string; notificationId?: string } | null {
	try {
		const parsed: unknown = JSON.parse(raw.toString("utf8"))
		if (!parsed || typeof parsed !== "object") return null
		const message = parsed as Record<string, unknown>
		const result: { type?: string; notificationId?: string } = {}
		if (typeof message.type === "string") result.type = message.type
		if (typeof message.notificationId === "string")
			result.notificationId = message.notificationId
		return result
	} catch {
		return null
	}
}

async function register(
	socket: WebSocket,
	request: IncomingMessage,
): Promise<void> {
	const token = socketTokens.get(socket)
	if (!token || !token.sub) {
		socket.close(1008, "Invalid token")
		return
	}
	const connectionId = crypto.randomUUID()
	const key = realtimeConnectionKey(token.workspaceId, token.sub)
	const connection: Connection = {
		socket,
		workspaceId: token.workspaceId,
		subscriberId: token.sub,
		connectionId,
		key,
		alive: true,
	}
	connections.set(connectionId, connection)
	activeWebSockets.inc()
	await redis.sadd(key, connectionId)
	await redis.expire(key, PRESENCE_TTL_SECONDS)
	logger.info(
		{
			connectionId,
			workspaceId: token.workspaceId,
			subscriberId: token.sub,
			path: request.url,
		},
		"WebSocket connected",
	)
	await flushPending(connection)

	socket.on("pong", () => {
		connection.alive = true
		void redis.expire(key, PRESENCE_TTL_SECONDS)
	})
	socket.on("message", (raw: Buffer) => {
		const message = parseClientMessage(raw)
		if (!message) return
		if (message.type === "ping") {
			send(socket, { type: "pong" })
			return
		}
		if (message.type === "ack" && message.notificationId) {
			void prisma.pendingInApp.updateMany({
				where: {
					workspaceId: connection.workspaceId,
					subscriberId: connection.subscriberId,
					notificationId: message.notificationId,
					deliveredAt: null,
				},
				data: { deliveredAt: new Date() },
			})
			void prisma.notification.updateMany({
				where: {
					id: message.notificationId,
					workspaceId: connection.workspaceId,
					subscriberId: connection.subscriberId,
				},
				data: { readAt: new Date() },
			})
		}
	})
	socket.on("close", () => {
		connections.delete(connectionId)
		activeWebSockets.dec()
		void redis.srem(key, connectionId)
		logger.info(
			{
				connectionId,
				workspaceId: token.workspaceId,
				subscriberId: token.sub,
			},
			"WebSocket disconnected",
		)
	})
	socket.on("error", (error) =>
		logger.warn({ connectionId, err: error }, "WebSocket error"),
	)
}

async function upgrade(
	request: IncomingMessage,
	socket: import("node:net").Socket,
	head: Buffer,
): Promise<void> {
	try {
		const url = new URL(
			request.url ?? "/",
			`http://${request.headers.host ?? "localhost"}`,
		)
		if (url.pathname !== "/ws") {
			socket.destroy()
			return
		}
		const token = url.searchParams.get("token")
		if (!token) throw new Error("Missing WebSocket token")
		const claims = await verifySubscriberWebSocketToken(token)
		webSocketServer.handleUpgrade(request, socket, head, (client) => {
			socketTokens.set(client, claims)
			webSocketServer.emit("connection", client, request)
		})
	} catch (error) {
		logger.warn({ err: error }, "Rejected WebSocket upgrade")
		socket.destroy()
	}
}

export function startWebSocketServer(server: Server): void {
	if (upgradeHandler) return
	upgradeHandler = (request, socket, head) =>
		void upgrade(request, socket, head)
	server.on("upgrade", upgradeHandler)
	webSocketServer.on(
		"connection",
		(socket, request) => void register(socket, request),
	)
	void pubsub
		.subscribe(REALTIME_CHANNEL)
		.catch((error) =>
			logger.error({ err: error }, "Realtime subscription failed"),
		)
	pubsub.on("message", (_channel, message) => {
		try {
			const event = JSON.parse(message) as InAppDeliveryEvent
			if (event.type === "in_app_delivery") void deliverLive(event)
		} catch (error) {
			logger.warn({ err: error }, "Invalid realtime event")
		}
	})
	heartbeat = setInterval(() => {
		for (const connection of connections.values()) {
			if (!connection.alive) {
				connection.socket.terminate()
				continue
			}
			connection.alive = false
			connection.socket.ping()
			void redis.expire(connection.key, PRESENCE_TTL_SECONDS)
		}
	}, HEARTBEAT_INTERVAL_MS)
}

export async function stopWebSocketServer(server: Server): Promise<void> {
	if (upgradeHandler) server.off("upgrade", upgradeHandler)
	if (heartbeat) clearInterval(heartbeat)
	for (const connection of connections.values())
		connection.socket.close(1001, "Server shutting down")
	connections.clear()
	await pubsub.unsubscribe(REALTIME_CHANNEL)
	await pubsub.quit()
	upgradeHandler = undefined
}

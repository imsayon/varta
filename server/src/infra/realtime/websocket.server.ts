import type { IncomingMessage, Server } from "node:http"
import { WebSocket, WebSocketServer } from "ws"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import { logger } from "@/infra/observability/logger.ts"
import {
	activeWebSockets,
	realtimeEvents,
} from "@/infra/observability/metrics.ts"
import {
	verifyWebSocketToken,
	type SubscriberWebSocketTokenPayload,
	type WorkspaceWebSocketTokenPayload,
} from "@/common/utils/auth/websocket-token.ts"
import { getRoutePolicy } from "@/common/auth/route-policy.ts"
import type {
	AuthorizationCapability,
	SubscriberWebSocketPrincipal,
} from "@/common/auth/principal.ts"
import {
	REALTIME_CHANNEL,
	realtimeConnectionKey,
	type InAppDeliveryEvent,
} from "./realtime.events.ts"
import { realtimeStateService } from "@/modules/notifications/realtime-state.service.ts"

const HEARTBEAT_INTERVAL_MS = 30_000
const PRESENCE_TTL_SECONDS = 35

type Connection = {
	socket: WebSocket
	workspaceId: string
	subscriberId: string
	kind: "subscriber" | "workspace"
	connectionId: string
	key: string
	alive: boolean
	expiresAt: number
	inFlight: Set<string>
	flushing: boolean
}

const webSocketServer = new WebSocketServer({
	noServer: true,
	maxPayload: 16 * 1024,
})
const pubsub = redis.duplicate()
pubsub.on("error", (error) =>
	logger.error({ err: error }, "Realtime Redis connection error"),
)
const connections = new Map<string, Connection>()
const socketTokens = new WeakMap<
	WebSocket,
	SubscriberWebSocketTokenPayload | WorkspaceWebSocketTokenPayload
>()
const socketCapabilities = new WeakMap<WebSocket, AuthorizationCapability>()
let heartbeat: NodeJS.Timeout | undefined
let upgradeHandler:
	| ((
			request: IncomingMessage,
			socket: import("node:net").Socket,
			head: Buffer,
	  ) => void)
	| undefined

function send(socket: WebSocket, message: unknown): boolean {
	if (socket.readyState !== WebSocket.OPEN) {
		realtimeEvents.inc({ event: "send", outcome: "not_open" })
		return false
	}
	if (socket.bufferedAmount > 1024 * 1024) {
		realtimeEvents.inc({ event: "send", outcome: "backpressure" })
		socket.close(1013, "Client is too slow")
		return false
	}
	socket.send(JSON.stringify(message))
	realtimeEvents.inc({ event: "send", outcome: "success" })
	return true
}

async function flushPending(connection: Connection): Promise<void> {
	if (connection.kind !== "subscriber" || connection.flushing || connection.inFlight.size >= 50) return
	connection.flushing = true
	try {
	const pending = await prisma.pendingInApp.findMany({
		where: {
			workspaceId: connection.workspaceId,
			subscriberId: connection.subscriberId,
			deliveredAt: null,
			notificationId: { notIn: [...connection.inFlight] },
		},
		take: 50 - connection.inFlight.size,
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
		connection.inFlight.add(item.notificationId)
	}
	} finally { connection.flushing = false }
}

async function deliverLive(event: InAppDeliveryEvent): Promise<void> {
	for (const connection of connections.values()) {
		if (
			connection.workspaceId !== event.workspaceId ||
			(connection.kind === "subscriber" &&
				connection.subscriberId !== event.subscriberId)
		)
			continue
		if (connection.kind === "subscriber") {
			await flushPending(connection)
			continue
		}
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
	const capability = socketCapabilities.get(socket)
	if (
		!token ||
		!token.sub ||
		(token.type === "subscriber_ws" && !capability)
	) {
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
		kind: token.type === "workspace_ws" ? "workspace" : "subscriber",
		alive: true,
		expiresAt: (token.exp ?? 0) * 1_000,
		inFlight: new Set(),
		flushing: false,
	}
	try {
		await redis.sAdd(key, connectionId)
		await redis.expire(key, PRESENCE_TTL_SECONDS)
	} catch (error) {
		logger.warn(
			{ err: error, connectionId },
			"WebSocket presence registration failed",
		)
		socket.close(1013, "Realtime service unavailable")
		return
	}
	connections.set(connectionId, connection)
	activeWebSockets.inc()
	realtimeEvents.inc({ event: "connection", outcome: "accepted" })
	logger.info(
		{
			connectionId,
			workspaceId: token.workspaceId,
			subscriberId: token.sub,
			path: "/ws",
		},
		"WebSocket connected",
	)
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
			if (connection.kind !== "subscriber") return
			void realtimeStateService.acknowledgeTransport(
				connection.workspaceId,
				connection.subscriberId,
				message.notificationId,
			).then(async () => {
				connection.inFlight.delete(message.notificationId!)
				await flushPending(connection)
			}).catch((error) => logger.warn({ err: error, connectionId }, "Realtime acknowledgement failed"))
			return
		}
		if (message.type === "read" && message.notificationId) {
			if (connection.kind !== "subscriber") return
			void realtimeStateService.markRead(
				connection.workspaceId,
				connection.subscriberId,
				message.notificationId,
			)
		}
	})
	socket.on("close", () => {
		connections.delete(connectionId)
		activeWebSockets.dec()
		realtimeEvents.inc({ event: "connection", outcome: "closed" })
		void redis.sRem(key, connectionId)
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
	await flushPending(connection)
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
		const claims = await verifyWebSocketToken(token)
		const policy = getRoutePolicy(
			claims.type === "workspace_ws"
				? "websocket.workspace"
				: "websocket.subscriber",
		)
		if (claims.type === "workspace_ws") {
			const membership = await prisma.workspaceMember.findUnique({
				where: {
					userId_workspaceId: {
						userId: claims.sub,
						workspaceId: claims.workspaceId,
					},
				},
			})
			if (!membership || !policy.principalKinds?.includes("browser_jwt"))
				throw new Error("Workspace WebSocket access denied")
			webSocketServer.handleUpgrade(request, socket, head, (client) => {
				socketTokens.set(client, claims)
				webSocketServer.emit("connection", client, request)
			})
			return
		}
		const principal: SubscriberWebSocketPrincipal = {
			kind: "subscriber_websocket",
			actorId: claims.sub,
			workspaceId: claims.workspaceId,
			subscriberId: claims.sub,
			scopes: ["realtime:subscribe"],
			verification: "not_applicable",
		}
		if (!policy.principalKinds?.includes(principal.kind)) {
			socket.destroy()
			return
		}
		webSocketServer.handleUpgrade(request, socket, head, (client) => {
			socketTokens.set(client, claims)
			socketCapabilities.set(client, {
				principal,
				workspace: {
					actorId: principal.actorId,
					workspaceId: principal.workspaceId,
					role: "SUBSCRIBER",
					scopes: principal.scopes,
					verification: principal.verification,
					principalKind: principal.kind,
				},
			})
			webSocketServer.emit("connection", client, request)
		})
	} catch (error) {
		logger.warn({ err: error }, "Rejected WebSocket upgrade")
		socket.destroy()
	}
}

export async function startWebSocketServer(server: Server): Promise<void> {
	if (upgradeHandler) return
	if (!pubsub.isOpen) await pubsub.connect()
	await pubsub.subscribe(REALTIME_CHANNEL, (message) => {
		try {
			const event = JSON.parse(message) as InAppDeliveryEvent
			if (event.type === "in_app_delivery") void deliverLive(event).catch((error) => logger.warn({ err: error }, "Realtime publication failed"))
		} catch (error) {
			logger.warn({ err: error }, "Invalid realtime event")
		}
	})
	upgradeHandler = (request, socket, head) =>
		void upgrade(request, socket, head)
	server.on("upgrade", upgradeHandler)
	webSocketServer.on(
		"connection",
		(socket, request) => void register(socket, request).catch((error) => {
			logger.warn({ err: error }, "Realtime registration failed")
			socket.close(1013, "Realtime unavailable")
		}),
	)
	heartbeat = setInterval(() => {
		for (const connection of connections.values()) {
			if (connection.expiresAt <= Date.now()) {
				connection.socket.close(1008, "Token expired")
				continue
			}
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
	if (pubsub.isOpen) {
		await pubsub.unsubscribe(REALTIME_CHANNEL)
		await pubsub.quit()
	}
	upgradeHandler = undefined
}

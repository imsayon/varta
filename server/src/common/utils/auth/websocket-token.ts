import { jwtVerify, SignJWT, type JWTPayload } from "jose"
import { randomUUID } from "node:crypto"
import { env } from "@/common/config/env.ts"

const websocketSecret = new TextEncoder().encode(env.JWT_WS_SECRET)

export interface SubscriberWebSocketTokenPayload extends JWTPayload {
	sub: string
	workspaceId: string
	type: "subscriber_ws"
}

export interface WorkspaceWebSocketTokenPayload extends JWTPayload {
	sub: string
	workspaceId: string
	type: "workspace_ws"
}

export async function generateSubscriberWebSocketToken(
	payload: Omit<SubscriberWebSocketTokenPayload, "iat" | "exp" | "type">,
): Promise<string> {
	return new SignJWT({ ...payload, type: "subscriber_ws" })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuer("varta")
		.setAudience("varta-ws")
		.setJti(randomUUID())
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(websocketSecret)
}

export async function generateWorkspaceWebSocketToken(
	payload: Omit<WorkspaceWebSocketTokenPayload, "iat" | "exp" | "type">,
): Promise<string> {
	return new SignJWT({ ...payload, type: "workspace_ws" })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuer("varta")
		.setAudience("varta-ws")
		.setJti(randomUUID())
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(websocketSecret)
}

export async function verifyWebSocketToken(
	token: string,
): Promise<SubscriberWebSocketTokenPayload | WorkspaceWebSocketTokenPayload> {
	const { payload } = await jwtVerify(token, websocketSecret, { issuer: "varta", audience: "varta-ws" })
	if ((payload.type !== "subscriber_ws" && payload.type !== "workspace_ws") || typeof payload.sub !== "string" || typeof payload.workspaceId !== "string") {
		throw new Error("Invalid WebSocket token")
	}
	return payload as SubscriberWebSocketTokenPayload | WorkspaceWebSocketTokenPayload
}

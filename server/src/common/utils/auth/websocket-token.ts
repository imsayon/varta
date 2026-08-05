import { jwtVerify, SignJWT, type JWTPayload } from "jose"
import { env } from "@/common/config/env.ts"

const websocketSecret = new TextEncoder().encode(env.JWT_WS_SECRET)

export interface SubscriberWebSocketTokenPayload extends JWTPayload {
	sub: string
	workspaceId: string
	type: "subscriber_ws"
}

export async function generateSubscriberWebSocketToken(
	payload: Omit<SubscriberWebSocketTokenPayload, "iat" | "exp" | "type">,
): Promise<string> {
	return new SignJWT({ ...payload, type: "subscriber_ws" })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuer("varta")
		.setAudience("varta-ws")
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(websocketSecret)
}

export async function verifySubscriberWebSocketToken(
	token: string,
): Promise<SubscriberWebSocketTokenPayload> {
	const { payload } = await jwtVerify(token, websocketSecret, {
		issuer: "varta",
		audience: "varta-ws",
	})
	if (
		payload.type !== "subscriber_ws" ||
		typeof payload.sub !== "string" ||
		typeof payload.workspaceId !== "string"
	) {
		throw new Error("Invalid subscriber WebSocket token")
	}
	return payload as SubscriberWebSocketTokenPayload
}

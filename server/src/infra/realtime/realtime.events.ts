import { redis } from "@/infra/redis/redis.connection.ts"

export const REALTIME_CHANNEL = "varta:realtime"

export function realtimeConnectionKey(
	workspaceId: string,
	subscriberId: string,
): string {
	return `varta:ws:${workspaceId}:${subscriberId}`
}

export type InAppDeliveryEvent = {
	type: "in_app_delivery"
	workspaceId: string
	subscriberId: string
	notificationId: string
	content: Record<string, unknown>
}

export async function publishInAppDelivery(
	event: InAppDeliveryEvent,
): Promise<void> {
	await redis.publish(REALTIME_CHANNEL, JSON.stringify(event))
}

import { prisma } from "@/infra/database/prisma.ts"

export const realtimeStateService = {
	async acknowledgeTransport(
		workspaceId: string,
		subscriberId: string,
		notificationId: string,
	): Promise<boolean> {
		const result = await prisma.pendingInApp.updateMany({
			where: {
				workspaceId,
				subscriberId,
				notificationId,
				deliveredAt: null,
			},
			data: { deliveredAt: new Date() },
		})
		return result.count > 0
	},

	async markRead(
		workspaceId: string,
		subscriberId: string,
		notificationId: string,
	): Promise<boolean> {
		const result = await prisma.notification.updateMany({
			where: { id: notificationId, workspaceId, subscriberId },
			data: { readAt: new Date() },
		})
		return result.count > 0
	},
}

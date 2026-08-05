import { prisma } from "@/infra/database/prisma.ts"
import { Prisma, NotificationStatus } from "@prisma/client"
import { NotFoundError } from "@/common/errors/app-error.ts"

export const notificationRepository = {
	async create(data: Prisma.NotificationUncheckedCreateInput) {
		return prisma.notification.create({ data })
	},

	async findById(workspaceId: string, id: string) {
		return prisma.notification.findFirst({
			where: { id, workspaceId },
			include: {
				template: { select: { name: true } },
				subscriber: {
					select: { name: true, email: true, externalId: true },
				},
				deliveryAttempts: { orderBy: { attemptNumber: "asc" } },
			},
		})
	},

	async findByIdempotencyKey(workspaceId: string, idempotencyKey: string) {
		return prisma.notification.findFirst({
			where: { workspaceId, idempotencyKey },
			select: { id: true, status: true },
		})
	},

	async findMany(workspaceId: string, skip: number, take: number) {
		return Promise.all([
			prisma.notification.findMany({
				where: { workspaceId },
				include: {
					template: { select: { name: true } },
					subscriber: {
						select: { name: true, email: true, externalId: true },
					},
				},
				skip,
				take,
				orderBy: { triggeredAt: "desc" },
			}),
			prisma.notification.count({ where: { workspaceId } }),
		])
	},

	async updateStatus(
		workspaceId: string,
		id: string,
		status: NotificationStatus,
	) {
		const notification = await prisma.notification.findFirst({
			where: { id, workspaceId },
			select: { id: true },
		})

		if (!notification) {
			throw new NotFoundError("Notification not found")
		}

		return prisma.notification.update({
			where: { id },
			data: { status },
		})
	},

	async markRead(workspaceId: string, id: string) {
		const notification = await prisma.notification.findFirst({
			where: { id, workspaceId },
			select: { id: true },
		})
		if (!notification) throw new NotFoundError("Notification not found")
		return prisma.notification.update({
			where: { id: notification.id },
			data: { readAt: new Date() },
		})
	},
}

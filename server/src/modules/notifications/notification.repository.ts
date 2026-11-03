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
				deliveries: { orderBy: { channel: "asc" } },
			},
		})
	},

	async findByIdempotencyKey(workspaceId: string, idempotencyKey: string) {
		return prisma.notification.findFirst({
			where: { workspaceId, idempotencyKey },
			select: { id: true, status: true, channels: true, scheduledAt: true },
		})
	},

	async findMany(
		workspaceId: string,
		options: { cursorId?: string; take: number; status?: NotificationStatus; search?: string },
	) {
		const where: Prisma.NotificationWhereInput = {
			workspaceId,
			...(options.status ? { status: options.status } : {}),
			...(options.search ? {
				OR: [
					{ idempotencyKey: { contains: options.search, mode: "insensitive" } },
					{ subscriber: { externalId: { contains: options.search, mode: "insensitive" } } },
					{ template: { name: { contains: options.search, mode: "insensitive" } } },
				],
			} : {}),
		}
		return Promise.all([
			prisma.notification.findMany({
				where,
				include: {
					template: { select: { name: true } },
					subscriber: {
						select: { name: true, email: true, externalId: true },
					},
					deliveryAttempts: { orderBy: { attemptNumber: "asc" } },
					deliveries: { orderBy: { channel: "asc" } },
				},
				...(options.cursorId ? { cursor: { id: options.cursorId }, skip: 1 } : {}),
				take: options.take,
				orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
			}),
			prisma.notification.count({ where }),
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

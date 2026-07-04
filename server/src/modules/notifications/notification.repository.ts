import { prisma } from "@/infra/database/prisma.ts"
import { Prisma } from "@prisma/client"

export const notificationRepository = {
	async create(data: Prisma.NotificationUncheckedCreateInput) {
		return prisma.notification.create({ data })
	},

	async findById(workspaceId: string, id: string) {
		return prisma.notification.findUnique({
			where: { id },
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

	async updateStatus(id: string, status: any) {
		return prisma.notification.update({
			where: { id },
			data: { status },
		})
	},
}

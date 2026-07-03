import { prisma } from "@/infra/database/prisma.ts"
import { Prisma } from "@prisma/client"

export const deliveryAttemptRepository = {
	async create(data: Prisma.DeliveryAttemptUncheckedCreateInput) {
		return prisma.deliveryAttempt.create({ data })
	},

	async update(id: string, data: Prisma.DeliveryAttemptUncheckedUpdateInput) {
		return prisma.deliveryAttempt.update({
			where: { id },
			data,
		})
	},

	async findByNotification(notificationId: string) {
		return prisma.deliveryAttempt.findMany({
			where: { notificationId },
			orderBy: { attemptNumber: "asc" },
		})
	},
}

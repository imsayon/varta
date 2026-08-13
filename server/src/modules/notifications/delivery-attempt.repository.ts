import { prisma } from "@/infra/database/prisma.ts"
import { Prisma } from "@prisma/client"
import { deliveryAttempts, deliveryDuration } from "@/infra/observability/metrics.ts"

export const deliveryAttemptRepository = {
	async create(data: Prisma.DeliveryAttemptUncheckedCreateInput) {
		return prisma.deliveryAttempt.create({ data })
	},

	async update(id: string, data: Prisma.DeliveryAttemptUncheckedUpdateInput) {
		const attempt = await prisma.deliveryAttempt.update({
			where: { id },
			data,
		})
		if (["SUCCESS", "FAILED", "DLQ"].includes(attempt.status ?? "") && data.finishedAt !== undefined) {
			deliveryAttempts.inc({ channel: attempt.channel, outcome: attempt.status ?? "UNKNOWN" })
			if (attempt.durationMs !== null) deliveryDuration.observe({ channel: attempt.channel }, attempt.durationMs / 1_000)
		}
		return attempt
	},

	async findByNotification(notificationId: string) {
		return prisma.deliveryAttempt.findMany({
			where: { notificationId },
			orderBy: { attemptNumber: "asc" },
		})
	},
}

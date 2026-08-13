import type { DeliveryStatus, Prisma } from "@prisma/client"
import { prisma } from "@/infra/database/prisma.ts"
import { NotFoundError } from "@/common/errors/app-error.ts"
import { assertDeliveryTransition } from "./delivery-state.ts"

export const deliveryRepository = {
	async findForExecution(workspaceId: string, deliveryId: string) {
		return prisma.delivery.findFirst({
			where: { id: deliveryId, workspaceId },
			include: {
				notification: {
					include: { template: true, subscriber: true },
				},
			},
		})
	},

	async transition(
		workspaceId: string,
		deliveryId: string,
		to: DeliveryStatus,
		data: Prisma.DeliveryUpdateManyMutationInput = {},
	) {
		return prisma.$transaction(async (tx) => {
			const current = await tx.delivery.findFirst({
				where: { id: deliveryId, workspaceId },
				select: { status: true },
			})
			if (!current) throw new NotFoundError("Delivery not found")
			assertDeliveryTransition(current.status, to)
			const updated = await tx.delivery.updateMany({
				where: { id: deliveryId, workspaceId, status: current.status },
				data: { ...data, status: to },
			})
			if (updated.count !== 1) throw new Error("Concurrent delivery transition")
			return tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } })
		})
	},
}

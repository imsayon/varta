import { randomUUID } from "node:crypto"
import { MAX_DELIVERY_ATTEMPTS } from "@/infra/queues/queue.options.ts"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/infra/database/prisma.ts"
import { NotFoundError } from "@/common/errors/app-error.ts"

// Provider calls are bounded to 10 seconds; expired owners cannot persist outcomes.
const EXECUTION_LEASE_MS = 120_000

export const deliveryRepository = {
	async claim(workspaceId: string, deliveryId: string) {
		return prisma.$transaction(async (tx) => {
			await tx.$queryRaw`SELECT id FROM varta.deliveries WHERE id = ${deliveryId}::uuid AND workspace_id = ${workspaceId}::uuid FOR UPDATE`
			const delivery = await tx.delivery.findFirst({ where: { id: deliveryId, workspaceId } })
			if (!delivery) throw new NotFoundError("Delivery not found")
			const now = new Date()
			if (["SUCCESS", "DLQ"].includes(delivery.status) ||
				(delivery.scheduledAt && delivery.scheduledAt > now) ||
				(delivery.status === "RUNNING" && delivery.leaseUntil && delivery.leaseUntil > now)) return null
			const previous = await tx.deliveryAttempt.aggregate({ where: { deliveryId }, _max: { attemptNumber: true } })
			const attemptNumber = (previous._max.attemptNumber ?? 0) + 1
			await tx.deliveryAttempt.updateMany({
				where: { deliveryId, status: { in: ["PENDING", "RUNNING"] } },
				data: { status: "FAILED", finishedAt: now, errorMessage: "Execution lease expired; provider outcome may be unknown" },
			})
			if (attemptNumber > MAX_DELIVERY_ATTEMPTS) {
				await tx.delivery.update({ where: { id: deliveryId }, data: { status: "DLQ", leaseOwner: null, leaseUntil: null, lastError: "Delivery attempt limit reached" } })
				return null
			}
			const owner = randomUUID()
			await tx.delivery.update({ where: { id: deliveryId }, data: { status: "RUNNING", leaseOwner: owner, leaseUntil: new Date(now.getTime() + EXECUTION_LEASE_MS) } })
			const attempt = await tx.deliveryAttempt.create({ data: {
				notificationId: delivery.notificationId, deliveryId, channel: delivery.channel,
				provider: delivery.provider, attemptNumber, status: "RUNNING", enqueuedAt: now, startedAt: now,
			} })
			return { owner, attempt }
		})
	},

	async finish(workspaceId: string, deliveryId: string, owner: string, attemptId: string,
		status: "SUCCESS" | "FAILED" | "DLQ", data: {
			provider: string; providerMessageId?: string | undefined; providerResponse?: Prisma.InputJsonValue | undefined; errorMessage?: string | undefined; durationMs: number
		}) {
		return prisma.$transaction(async (tx) => {
			const now = new Date()
			const result = await tx.delivery.updateMany({
				where: { id: deliveryId, workspaceId, status: "RUNNING", leaseOwner: owner, leaseUntil: { gt: now } },
				data: { status, leaseOwner: null, leaseUntil: null, provider: data.provider, providerMessageId: data.providerMessageId ?? null, lastError: data.errorMessage ?? null },
			})
			if (!result.count) return false
			await tx.deliveryAttempt.update({ where: { id: attemptId, deliveryId }, data: {
				status, provider: data.provider, providerMessageId: data.providerMessageId ?? null,
				...(data.providerResponse === undefined ? {} : { providerResponse: data.providerResponse }), errorMessage: data.errorMessage ?? null,
				finishedAt: now, durationMs: data.durationMs,
			} })
			return true
		})
	},
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

}

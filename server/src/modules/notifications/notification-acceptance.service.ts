import { Prisma, type NotificationPriority } from "@prisma/client"
import { prisma } from "@/infra/database/prisma.ts"
import type { NotificationChannel } from "./notification.types.ts"
import { notificationAcceptance } from "@/infra/observability/metrics.ts"
import { currentTraceparent, withTrace } from "@/infra/observability/tracing.ts"
import { currentLogContext } from "@/infra/observability/log-context.ts"

type AcceptanceInput = {
	workspaceId: string
	templateId: string
	subscriberId: string
	idempotencyKey: string
	payload: Record<string, unknown>
	channels: NotificationChannel[]
	priority: NotificationPriority
	scheduledAt: Date | null
	smartTimingRequested: boolean
}

export type AcceptanceResult = {
	created: boolean
	notification: {
		id: string
		status: string
		channels: string[]
	}
}

export async function acceptNotification(
	input: AcceptanceInput,
): Promise<AcceptanceResult> {
	const { requestId, correlationId } = currentLogContext()
	try {
		const notification = await withTrace("db.notification.acceptance", {
			"db.system.name": "postgresql",
			"db.operation.name": "transaction",
		}, () => prisma.$transaction(async (tx) => {
			const created = await tx.notification.create({
				data: {
					workspaceId: input.workspaceId,
					templateId: input.templateId,
					subscriberId: input.subscriberId,
					idempotencyKey: input.idempotencyKey,
					triggerPayload: input.payload as Prisma.InputJsonValue,
					channels: input.channels,
					status: "PENDING",
					priority: input.priority,
					scheduledAt: input.scheduledAt,
					smartTimingRequested: input.smartTimingRequested,
				},
			})

			for (const channel of input.channels) {
				const delivery = await tx.delivery.create({
					data: {
						workspaceId: input.workspaceId,
						notificationId: created.id,
						channel,
						status: "PENDING",
						scheduledAt: input.scheduledAt,
					},
				})
				await tx.outboxIntent.create({
					data: {
						workspaceId: input.workspaceId,
						deliveryId: delivery.id,
						eventType: "delivery.requested.v1",
						payload: {
							version: 1,
							requestId,
							correlationId,
							traceparent: currentTraceparent(),
						},
						availableAt: input.scheduledAt ?? new Date(),
					},
				})
			}

			return tx.notification.update({
				where: { id: created.id },
				data: { status: "ENQUEUED" },
				select: { id: true, status: true, channels: true },
			})
		}))
		notificationAcceptance.inc({ outcome: "created" })
		return { created: true, notification }
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			const existing = await prisma.notification.findUnique({
				where: {
					workspaceId_idempotencyKey: {
						workspaceId: input.workspaceId,
						idempotencyKey: input.idempotencyKey,
					},
				},
				select: { id: true, status: true, channels: true },
			})
			if (existing) {
				notificationAcceptance.inc({ outcome: "duplicate" })
				return { created: false, notification: existing }
			}
		}
		notificationAcceptance.inc({ outcome: "failed" })
		throw error
	}
}

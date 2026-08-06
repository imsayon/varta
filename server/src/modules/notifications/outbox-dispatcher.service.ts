import crypto from "node:crypto"
import { prisma } from "@/infra/database/prisma.ts"
import { queueService } from "@/infra/queues/queue.service.ts"
import { outboxFailures, outboxLagSeconds, outboxLeases } from "@/infra/observability/metrics.ts"
import { claimOutboxIntents } from "./outbox.repository.ts"

const PUBLISH_TIMEOUT_MS = 5_000

async function withPublishTimeout<T>(operation: Promise<T>): Promise<T> {
	let timer: NodeJS.Timeout | undefined
	try {
		return await Promise.race([
			operation,
			new Promise<never>((_resolve, reject) => {
				timer = setTimeout(
					() => reject(new Error("Queue publication timed out")),
					PUBLISH_TIMEOUT_MS,
				)
			}),
		])
	} finally {
		if (timer) clearTimeout(timer)
	}
}

function nextAttemptAt(attempts: number): Date {
	const base = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6))
	const jitter = crypto.randomInt(0, Math.max(1, Math.floor(base / 4)))
	return new Date(Date.now() + base + jitter)
}

export async function dispatchOutboxBatch(owner = crypto.randomUUID()) {
	const intents = await claimOutboxIntents(owner)
	outboxLeases.set(intents.length)
	outboxLagSeconds.set(
		intents.length === 0
			? 0
			: Math.max(...intents.map((intent) => (Date.now() - intent.createdAt.getTime()) / 1_000)),
	)
	for (const intent of intents) {
		try {
			const payload = {
				version: 1 as const,
				notificationId: intent.delivery.notificationId,
				deliveryId: intent.delivery.id,
				workspaceId: intent.workspaceId,
			}
			if (intent.delivery.channel === "EMAIL") {
				await withPublishTimeout(queueService.enqueueEmail(payload))
			} else if (intent.delivery.channel === "IN_APP") {
				await withPublishTimeout(queueService.enqueueInApp(payload))
			} else if (intent.delivery.channel === "WEBHOOK") {
				await withPublishTimeout(queueService.enqueueWebhook(payload))
			} else {
				throw new Error(`Unsupported outbox channel: ${intent.delivery.channel}`)
			}
			await prisma.outboxIntent.updateMany({
				where: { id: intent.id, status: "LEASED", leaseOwner: owner },
				data: {
					status: "PUBLISHED",
					publishedAt: new Date(),
					leaseOwner: null,
					leaseUntil: null,
					lastError: null,
				},
			})
		} catch (error) {
			outboxFailures.inc({ channel: intent.delivery.channel })
			const attempts = intent.attempts + 1
			await prisma.outboxIntent.updateMany({
				where: { id: intent.id, status: "LEASED", leaseOwner: owner },
				data: {
					status: "FAILED",
					attempts,
					availableAt: nextAttemptAt(attempts),
					leaseOwner: null,
					leaseUntil: null,
					lastError:
						error instanceof Error
							? error.message.slice(0, 1_000)
							: "Outbox publication failed",
				},
			})
		}
	}
	outboxLeases.set(0)
	return intents.length
}

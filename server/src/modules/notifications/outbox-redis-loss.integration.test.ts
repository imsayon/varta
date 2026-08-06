import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { prisma } from "@/infra/database/prisma.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { NotificationChannel } from "./notification.types.ts"

const runFaultTests = process.env.RUN_NOTIFICATION_FAULT_TESTS === "true"

test(
	"Redis loss leaves committed notification intent recoverable in PostgreSQL",
	{ skip: !runFaultTests },
	async () => {
		const [{ closeQueues }, { dispatchOutboxBatch }] = await Promise.all([
			import("@/infra/queues/queue.factory.ts"),
			import("./outbox-dispatcher.service.ts"),
		])
		const marker = randomUUID()
		const workspace = await prisma.workspace.create({
			data: { name: "Redis fault", slug: `redis-fault-${marker}` },
		})
		try {
			const template = await prisma.template.create({
				data: { workspaceId: workspace.id, name: "Template", channels: {} },
			})
			const subscriber = await prisma.subscriber.create({
				data: { workspaceId: workspace.id, externalId: `subscriber-${marker}` },
			})
			const accepted = await acceptNotification({
				workspaceId: workspace.id,
				templateId: template.id,
				subscriberId: subscriber.id,
				idempotencyKey: `redis-fault-${marker}`,
				payload: {},
				channels: [NotificationChannel.IN_APP],
				priority: "NORMAL",
				scheduledAt: null,
				smartTimingRequested: false,
			})
			assert.equal(await dispatchOutboxBatch(`redis-fault-${marker}`), 1)
			const intent = await prisma.outboxIntent.findFirstOrThrow({
				where: { delivery: { notificationId: accepted.notification.id } },
			})
			assert.equal(intent.status, "FAILED")
			assert.match(intent.lastError ?? "", /timed out/i)
			assert.ok(intent.availableAt > new Date())
		} finally {
			await prisma.workspace.delete({ where: { id: workspace.id } })
			await Promise.allSettled([closeQueues(), prisma.$disconnect()])
		}
	},
)

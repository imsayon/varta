import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { disconnectDatabase, prisma } from "@/infra/database/prisma.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { NotificationChannel } from "./notification.types.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"

const runFaultTests = process.env.RUN_NOTIFICATION_FAULT_TESTS === "true"

test(
	"Redis loss leaves committed notification intent recoverable in PostgreSQL",
	{ skip: !runFaultTests },
	async () => {
		const [{ closeQueues }, { disconnectRedis }, { dispatchOutboxBatch }] = await Promise.all([
			import("@/infra/queues/queue.factory.ts"),
			import("@/infra/redis/redis.connection.ts"),
			import("./outbox-dispatcher.service.ts"),
		])
		const marker = randomUUID()
		const fixture = await createOwnedTestWorkspace("Redis fault")
		const { workspace } = fixture
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
			assert.match(intent.lastError ?? "", /(?:ECONNREFUSED|timed out)/i)
			assert.ok(intent.availableAt > new Date())
		} finally {
			await fixture.cleanup()
			await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
		}
	},
)

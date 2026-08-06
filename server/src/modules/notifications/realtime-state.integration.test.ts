import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { prisma } from "@/infra/database/prisma.ts"
import { realtimeStateService } from "./realtime-state.service.ts"

const runDatabaseTests = process.env.RUN_NOTIFICATION_DATABASE_TESTS === "true"

test(
	"in-app acknowledgement and read state stay separate and tenant scoped",
	{ skip: !runDatabaseTests },
	async () => {
		const marker = randomUUID()
		const workspaces = await Promise.all([
			prisma.workspace.create({ data: { name: "Realtime A", slug: `realtime-a-${marker}` } }),
			prisma.workspace.create({ data: { name: "Realtime B", slug: `realtime-b-${marker}` } }),
		])
		try {
			const records = await Promise.all(
				workspaces.map(async (workspace) => {
					const template = await prisma.template.create({
						data: { workspaceId: workspace.id, name: "Template", channels: {} },
					})
					const subscriber = await prisma.subscriber.create({
						data: { workspaceId: workspace.id, externalId: "same-external-id" },
					})
					const notification = await prisma.notification.create({
						data: {
							workspaceId: workspace.id,
							templateId: template.id,
							subscriberId: subscriber.id,
							idempotencyKey: `realtime-${marker}`,
							channels: ["IN_APP"],
						},
					})
					await prisma.pendingInApp.create({
						data: {
							workspaceId: workspace.id,
							subscriberId: subscriber.id,
							notificationId: notification.id,
							content: { title: "Test" },
						},
					})
					return { workspace, subscriber, notification }
				}),
			)
			const [a, b] = records
			assert.ok(a && b)
			assert.equal(
				await realtimeStateService.acknowledgeTransport(
					a.workspace.id,
					a.subscriber.id,
					a.notification.id,
				),
				true,
			)
			assert.equal(
				(await prisma.notification.findUniqueOrThrow({ where: { id: a.notification.id } })).readAt,
				null,
			)
			assert.equal(
				(await prisma.pendingInApp.findUniqueOrThrow({ where: { notificationId: b.notification.id } })).deliveredAt,
				null,
			)
			assert.equal(
				await realtimeStateService.markRead(
					a.workspace.id,
					a.subscriber.id,
					a.notification.id,
				),
				true,
			)
			assert.notEqual(
				(await prisma.notification.findUniqueOrThrow({ where: { id: a.notification.id } })).readAt,
				null,
			)
		} finally {
			await prisma.workspace.deleteMany({ where: { id: { in: workspaces.map((w) => w.id) } } })
			await prisma.$disconnect()
		}
	},
)

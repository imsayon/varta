import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { disconnectDatabase, prisma } from "@/infra/database/prisma.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { NotificationChannel } from "./notification.types.ts"

const enabled = process.env.RUN_CAPACITY_TESTS === "true"

test("disposable database sustains a bounded concurrent acceptance burst", { skip: !enabled }, async () => {
	const marker = randomUUID()
	const workspace = await prisma.workspace.create({ data: { name: "Capacity", slug: `capacity-${marker}` } })
	try {
		const template = await prisma.template.create({ data: { workspaceId: workspace.id, name: "Capacity template", channels: {} } })
		const subscriber = await prisma.subscriber.create({ data: { workspaceId: workspace.id, externalId: `capacity-${marker}` } })
		const started = performance.now()
		const samples: number[] = []
		const concurrency = 10
		for (let offset = 0; offset < 100; offset += concurrency) {
			const batch = await Promise.all(Array.from({ length: concurrency }, async (_, batchIndex) => {
				const index = offset + batchIndex
				const requestStarted = performance.now()
				await acceptNotification({
					workspaceId: workspace.id,
					templateId: template.id,
					subscriberId: subscriber.id,
					idempotencyKey: `${marker}-${index}`,
					payload: {},
					channels: [NotificationChannel.IN_APP],
					priority: "NORMAL",
					scheduledAt: null,
					smartTimingRequested: false,
				})
				return performance.now() - requestStarted
			}))
			samples.push(...batch)
		}
		const sorted = samples.toSorted((a, b) => a - b)
		const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? Number.POSITIVE_INFINITY
		assert.equal(await prisma.notification.count({ where: { workspaceId: workspace.id } }), 100)
		assert.ok(p95 < 5_000, `acceptance p95 ${p95.toFixed(1)}ms exceeded the local safety bound`)
		assert.ok(performance.now() - started < 30_000)
	} finally {
		await prisma.workspace.delete({ where: { id: workspace.id } })
		await disconnectDatabase()
	}
})

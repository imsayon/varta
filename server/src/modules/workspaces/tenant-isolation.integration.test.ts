import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { disconnectDatabase, prisma } from "@/infra/database/prisma.ts"
import { apiKeyService } from "@/modules/api-keys/api-key.service.ts"
import { notificationRepository } from "@/modules/notifications/notification.repository.ts"
import { providerRepository } from "@/modules/providers/provider.repository.ts"
import { routingRuleRepository } from "@/modules/routing-rules/routing-rule.repository.ts"
import { subscriberRepository } from "@/modules/subscribers/subscriber.repository.ts"
import { templateRepository } from "@/modules/templates/template.repository.ts"

const runDatabaseTests = process.env.RUN_TENANT_DATABASE_TESTS === "true"

test(
	"tenant repositories reject cross-workspace identifiers",
	{ skip: !runDatabaseTests },
	async () => {
		const marker = randomUUID()
		const [workspaceA, workspaceB] = await Promise.all([
			prisma.workspace.create({
				data: { name: "Tenant A", slug: `tenant-a-${marker}` },
			}),
			prisma.workspace.create({
				data: { name: "Tenant B", slug: `tenant-b-${marker}` },
			}),
		])
		try {
			const template = await prisma.template.create({
				data: { workspaceId: workspaceA.id, name: "Template", channels: {} },
			})
			const subscriber = await prisma.subscriber.create({
				data: {
					workspaceId: workspaceA.id,
					externalId: `subscriber-${marker}`,
				},
			})
			const rule = await prisma.routingRule.create({
				data: {
					workspaceId: workspaceA.id,
					name: "Rule",
					ruleAst: { channels: [] },
				},
			})
			const notification = await prisma.notification.create({
				data: {
					workspaceId: workspaceA.id,
					templateId: template.id,
					subscriberId: subscriber.id,
					idempotencyKey: `notification-${marker}`,
					channels: [],
				},
			})
			await prisma.providerConfig.create({
				data: {
					workspaceId: workspaceA.id,
					channel: "EMAIL",
					provider: "resend",
					config: {},
				},
			})
			const apiKey = await apiKeyService.create(
				workspaceA.id,
				"Tenant key",
				[],
			)

			await assert.rejects(() =>
				templateRepository.update(workspaceB.id, template.id, {
					name: "Cross tenant",
				}),
			)
			await assert.rejects(() =>
				subscriberRepository.update(workspaceB.id, subscriber.id, {
					name: "Cross tenant",
				}),
			)
			assert.equal(
				await routingRuleRepository.update(workspaceB.id, rule.id, {
					name: "Cross tenant",
				}),
				null,
			)
			await assert.rejects(() =>
				notificationRepository.updateStatus(
					workspaceB.id,
					notification.id,
					"FAILED",
				),
			)
			assert.equal(
				await providerRepository.findByWorkspaceAndChannel(
					workspaceB.id,
					"EMAIL",
				),
				null,
			)
			await assert.rejects(() => apiKeyService.revoke(workspaceB.id, apiKey.id))

			assert.equal(
				(await prisma.template.findUniqueOrThrow({ where: { id: template.id } }))
					.name,
				"Template",
			)
			assert.equal(
				(await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } }))
					.name,
				null,
			)
		} finally {
			await prisma.workspace.deleteMany({
				where: { id: { in: [workspaceA.id, workspaceB.id] } },
			})
			await disconnectDatabase()
		}
	},
)

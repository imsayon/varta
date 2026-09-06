import { prisma, disconnectDatabase } from "../src/infra/database/prisma.ts"
import { workspaceService } from "../src/modules/workspaces/workspace.service.ts"

// An existing owner account is required; this script never creates a shared login or sends messages.
const email = process.env.SHOWCASE_OWNER_EMAIL?.trim().toLowerCase()
if (!email) throw new Error("Set SHOWCASE_OWNER_EMAIL to the existing showcase owner's email")
try {
	const owner = await prisma.user.findUniqueOrThrow({ where: { email } })
	const name = "Varta Showcase — sample data"
	const workspace = await prisma.workspace.findFirst({ where: { name, members: { some: { userId: owner.id, role: "OWNER" } } } })
		?? await workspaceService.create(name, owner.id)
	await prisma.subscriber.upsert({
		where: { workspaceId_externalId: { workspaceId: workspace.id, externalId: "sample-reviewer" } },
		create: { workspaceId: workspace.id, externalId: "sample-reviewer", name: "Sample reviewer", email: owner.email, attributes: { plan: "vip" } }, update: {},
	})
	for (const digest of [false, true]) {
		const templateName = digest ? "Sample digest" : "Sample in-app notification"
		await prisma.template.upsert({
			where: { workspaceId_name: { workspaceId: workspace.id, name: templateName } },
			create: { workspaceId: workspace.id, name: templateName,
				channels: { inapp: { title: "Hello {{subscriber.name}}", body: "Sample message from the Varta showcase." } },
				...(digest ? { digestConfig: { windowMs: 60_000, maxItems: 20 } } : {}) }, update: {},
		})
	}
	if (!await prisma.routingRule.findFirst({ where: { workspaceId: workspace.id, name: "Sample VIP in-app rule" } })) {
		await prisma.routingRule.create({ data: { workspaceId: workspace.id, name: "Sample VIP in-app rule", priority: 0,
			ruleAst: { logic: "AND", conditions: [{ field: "subscriber.attributes.plan", op: "eq", value: "vip" }], channels: ["IN_APP"] } } })
	}
	console.log(JSON.stringify({ workspaceId: workspace.id, name, message: "Sample configuration ready. Trigger from Studio to generate real delivery history." }))
} finally { await disconnectDatabase() }

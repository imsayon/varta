import { randomUUID } from "node:crypto"
import { prisma } from "@/infra/database/prisma.ts"
import { workspaceService } from "@/modules/workspaces/workspace.service.ts"

export async function createOwnedTestWorkspace(name: string) {
	const marker = randomUUID()
	const user = await prisma.user.create({
		data: {
			email: `${marker}@billing-fixture.example.test`,
			name: "Billing Fixture Owner",
			emailVerified: true,
		},
	})
	try {
		const workspace = await workspaceService.create(name, user.id)
		return {
			user,
			workspace,
			async cleanup() {
				await prisma.workspace.deleteMany({ where: { id: workspace.id } })
				await prisma.billingAccount.deleteMany({ where: { ownerUserId: user.id } })
				await prisma.user.deleteMany({ where: { id: user.id } })
			},
		}
	} catch (error) {
		await prisma.user.deleteMany({ where: { id: user.id } })
		throw error
	}
}

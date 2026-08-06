import { prisma } from "@/infra/database/prisma.ts"
import type { Prisma } from "@prisma/client"

export const routingRuleRepository = {
	async list(workspaceId: string) {
		return prisma.routingRule.findMany({
			where: { workspaceId },
			orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
		})
	},

	async findById(workspaceId: string, id: string) {
		return prisma.routingRule.findFirst({
			where: { workspaceId, id },
		})
	},

	async create(data: Prisma.RoutingRuleUncheckedCreateInput) {
		return prisma.routingRule.create({ data })
	},

	async update(
		workspaceId: string,
		id: string,
		data: Prisma.RoutingRuleUpdateManyMutationInput,
	) {
		return prisma.$transaction(async (tx) => {
			const updated = await tx.routingRule.updateMany({
				where: { id, workspaceId },
				data,
			})
			if (updated.count !== 1) return null
			return tx.routingRule.findUniqueOrThrow({ where: { id } })
		})
	},

	async delete(workspaceId: string, id: string) {
		const deleted = await prisma.routingRule.deleteMany({ where: { id, workspaceId } })
		return deleted.count === 1
	},
}

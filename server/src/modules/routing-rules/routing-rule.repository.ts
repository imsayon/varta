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
		data: Prisma.RoutingRuleUncheckedUpdateInput,
	) {
		const rule = await this.findById(workspaceId, id)
		if (!rule) return null
		return prisma.routingRule.update({ where: { id: rule.id }, data })
	},

	async delete(workspaceId: string, id: string) {
		const rule = await this.findById(workspaceId, id)
		if (!rule) return null
		return prisma.routingRule.delete({ where: { id: rule.id } })
	},
}

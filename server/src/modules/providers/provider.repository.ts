import { prisma } from "@/infra/database/prisma.ts"
import { Prisma } from "@prisma/client"

export const providerRepository = {
	async create(data: Prisma.ProviderConfigUncheckedCreateInput) {
		return prisma.providerConfig.create({ data })
	},

	async findByWorkspaceAndChannel(workspaceId: string, channel: string) {
		return prisma.providerConfig.findUnique({
			where: { workspaceId_channel: { workspaceId, channel } }
		})
	},

	async findManyByWorkspace(workspaceId: string) {
		return prisma.providerConfig.findMany({
			where: { workspaceId },
			orderBy: { channel: "asc" },
		})
	},

	async update(workspaceId: string, channel: string, data: Prisma.ProviderConfigUncheckedUpdateInput) {
		return prisma.providerConfig.update({
			where: { workspaceId_channel: { workspaceId, channel } },
			data
		})
	},

	async delete(workspaceId: string, channel: string) {
		return prisma.providerConfig.delete({
			where: { workspaceId_channel: { workspaceId, channel } }
		})
	}
}

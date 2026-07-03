import { prisma } from "@/infra/database/prisma.ts"
import type { Prisma } from "@prisma/client"

export const subscriberRepository = {
	async create(data: Prisma.SubscriberUncheckedCreateInput) {
		return prisma.subscriber.create({ data })
	},

	async upsert(
		workspaceId: string,
		externalId: string,
		data: Prisma.SubscriberUncheckedCreateInput,
	) {
		return prisma.subscriber.upsert({
			where: { workspaceId_externalId: { workspaceId, externalId } },
			update: data,
			create: data,
		})
	},

	async findByExternalId(workspaceId: string, externalId: string) {
		return prisma.subscriber.findUnique({
			where: { workspaceId_externalId: { workspaceId, externalId } },
		})
	},

	async findById(workspaceId: string, id: string) {
		return prisma.subscriber.findFirst({
			where: { id, workspaceId },
		})
	},

	async findMany(workspaceId: string, skip: number, take: number) {
		return Promise.all([
			prisma.subscriber.findMany({
				where: { workspaceId },
				skip,
				take,
				orderBy: { createdAt: "desc" },
			}),
			prisma.subscriber.count({ where: { workspaceId } }),
		])
	},

	async update(
		workspaceId: string,
		id: string,
		data: Prisma.SubscriberUncheckedUpdateInput,
	) {
		return prisma.subscriber.update({ where: { id }, data })
	},

	async delete(workspaceId: string, id: string) {
		return prisma.subscriber.delete({ where: { id } })
	},
}

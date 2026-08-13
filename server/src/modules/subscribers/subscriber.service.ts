import { subscriberRepository } from "./subscriber.repository.ts"
import type { Prisma } from "@prisma/client"
import type { DecodedCursor } from "@/common/utils/pagination.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { assertSubscriberCapacityTx } from "@/modules/billing/billing.service.ts"

export const subscriberService = {
	async create(data: Prisma.SubscriberUncheckedCreateInput) {
		return prisma.$transaction(async (tx) => {
			await assertSubscriberCapacityTx(tx, data.workspaceId)
			return tx.subscriber.create({ data })
		})
	},

	async upsert(
		workspaceId: string,
		externalId: string,
		data: Prisma.SubscriberUncheckedCreateInput,
	) {
		return prisma.$transaction(async (tx) => {
			const existing = await tx.subscriber.findUnique({
				where: { workspaceId_externalId: { workspaceId, externalId } },
				select: { id: true },
			})
			if (!existing) await assertSubscriberCapacityTx(tx, workspaceId)
			return tx.subscriber.upsert({
				where: { workspaceId_externalId: { workspaceId, externalId } },
				update: { ...data, workspaceId, externalId },
				create: { ...data, workspaceId, externalId },
			})
		})
	},

	async findByExternalId(workspaceId: string, externalId: string) {
		return subscriberRepository.findByExternalId(workspaceId, externalId)
	},

	async findById(workspaceId: string, id: string) {
		return subscriberRepository.findById(workspaceId, id)
	},

	async search(workspaceId: string, take: number, cursor: DecodedCursor | null) {
		return subscriberRepository.findMany(workspaceId, take, cursor)
	},

	async update(
		workspaceId: string,
		id: string,
		data: Prisma.SubscriberUpdateManyMutationInput,
	) {
		return subscriberRepository.update(workspaceId, id, data)
	},

	async delete(workspaceId: string, id: string) {
		return subscriberRepository.delete(workspaceId, id)
	},
}

import { subscriberRepository } from "./subscriber.repository.ts"
import type { Prisma } from "@prisma/client"
import type { DecodedCursor } from "@/common/utils/pagination.ts"

export const subscriberService = {
	async create(data: Prisma.SubscriberUncheckedCreateInput) {
		return subscriberRepository.create(data)
	},

	async upsert(
		workspaceId: string,
		externalId: string,
		data: Prisma.SubscriberUncheckedCreateInput,
	) {
		return subscriberRepository.upsert(workspaceId, externalId, data)
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

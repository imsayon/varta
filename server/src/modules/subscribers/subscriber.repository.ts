import { prisma } from "@/infra/database/prisma.ts"
import { ConflictError, NotFoundError } from "@/common/errors/app-error.ts"
import type { Prisma } from "@prisma/client"
import type { DecodedCursor } from "@/common/utils/pagination.ts"

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
			update: { ...data, workspaceId, externalId },
			create: { ...data, workspaceId, externalId },
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

	async findMany(workspaceId: string, take: number, cursor: DecodedCursor | null) {
		const cursorDate = cursor ? new Date(cursor.createdAt) : null
		return Promise.all([
			prisma.subscriber.findMany({
				where: {
					workspaceId,
					...(cursorDate ? { OR: [
						{ createdAt: { lt: cursorDate } },
						{ createdAt: cursorDate, id: { lt: cursor!.id } },
					] } : {}),
				},
				take,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			}),
			prisma.subscriber.count({ where: { workspaceId } }),
		])
	},

	async update(
		workspaceId: string,
		id: string,
		data: Prisma.SubscriberUpdateManyMutationInput,
	) {
		return prisma.$transaction(async (tx) => {
			const updated = await tx.subscriber.updateMany({
				where: { id, workspaceId },
				data,
			})
			if (updated.count !== 1) throw new NotFoundError("Subscriber not found")
			return tx.subscriber.findUniqueOrThrow({ where: { id } })
		})
	},

	async delete(workspaceId: string, id: string) {
		const subscriber = await prisma.subscriber.findFirst({
			where: { id, workspaceId },
			select: { id: true },
		})

		if (!subscriber) {
			throw new NotFoundError("Subscriber not found")
		}

		const dependentNotifications = await prisma.notification.count({
			where: { subscriberId: id, workspaceId },
		})

		if (dependentNotifications > 0) {
			throw new ConflictError(
				"Subscriber has notification history and cannot be deleted",
			)
		}

		const deleted = await prisma.subscriber.deleteMany({ where: { id, workspaceId } })
		if (deleted.count !== 1) throw new NotFoundError("Subscriber not found")
	},
}

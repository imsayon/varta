import { prisma } from "@/infra/database/prisma.ts"
import { Prisma } from "@prisma/client"
import { NotFoundError } from "@/common/errors/app-error.ts"
import type { DecodedCursor } from "@/common/utils/pagination.ts"

export const templateRepository = {
	async create(data: Prisma.TemplateUncheckedCreateInput) {
		return prisma.template.create({ data })
	},

	async findById(workspaceId: string, id: string) {
		return prisma.template.findFirst({
			where: { id, workspaceId },
		})
	},

	async findByName(workspaceId: string, name: string) {
		return prisma.template.findUnique({
			where: { workspaceId_name: { workspaceId, name } },
		})
	},

	async findMany(workspaceId: string, take: number, cursor: DecodedCursor | null) {
		const cursorDate = cursor ? new Date(cursor.createdAt) : null
		return Promise.all([
			prisma.template.findMany({
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
			prisma.template.count({ where: { workspaceId } }),
		])
	},

	async update(
		workspaceId: string,
		id: string,
		data: Prisma.TemplateUpdateManyMutationInput,
	) {
		return prisma.$transaction(async (tx) => {
			const updated = await tx.template.updateMany({
				where: { id, workspaceId },
				data,
			})
			if (updated.count !== 1) throw new NotFoundError("Template not found")
			return tx.template.findUniqueOrThrow({ where: { id } })
		})
	},

	async delete(workspaceId: string, id: string) {
		const deleted = await prisma.template.deleteMany({ where: { id, workspaceId } })
		if (deleted.count !== 1) throw new NotFoundError("Template not found")
	},
}

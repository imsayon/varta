import { prisma } from "@/infra/database/prisma.ts"
import { Prisma } from "@prisma/client"

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

	async findMany(workspaceId: string, skip: number, take: number) {
		return Promise.all([
			prisma.template.findMany({
				where: { workspaceId },
				skip,
				take,
				orderBy: { updatedAt: "desc" },
			}),
			prisma.template.count({ where: { workspaceId } }),
		])
	},

	async update(
		workspaceId: string,
		id: string,
		data: Prisma.TemplateUncheckedUpdateInput,
	) {
		return prisma.template.update({
			where: { id },
			data,
		})
	},

	async delete(workspaceId: string, id: string) {
		return prisma.template.delete({
			where: { id },
		})
	},
}

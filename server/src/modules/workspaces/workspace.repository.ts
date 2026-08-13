import { prisma } from "@/infra/database/prisma.ts"
import type { Prisma, WorkspaceRole } from "@prisma/client"
import { assertMemberCapacityTx, linkWorkspaceToBillingAccountTx } from "@/modules/billing/billing.service.ts"

export const workspaceRepository = {
	async create(data: { name: string; slug: string; ownerId: string }) {
		return prisma.$transaction(async (tx) => {
			const workspace = await tx.workspace.create({
				data: {
					name: data.name,
					slug: data.slug,
					members: { create: { userId: data.ownerId, role: "OWNER" } },
				},
				include: { members: true },
			})
			await linkWorkspaceToBillingAccountTx(tx, data.ownerId, workspace.id)
			return workspace
		})
	},

	async findById(id: string) {
		return prisma.workspace.findUnique({ where: { id } })
	},

	async findBySlug(slug: string) {
		return prisma.workspace.findUnique({ where: { slug } })
	},

	async update(id: string, data: Prisma.WorkspaceUpdateInput) {
		return prisma.workspace.update({ where: { id }, data })
	},

	async delete(id: string) {
		return prisma.workspace.delete({ where: { id } })
	},

	async findMember(workspaceId: string, userId: string) {
		return prisma.workspaceMember.findUnique({
			where: { userId_workspaceId: { userId, workspaceId } },
		})
	},

	async listMembers(workspaceId: string, skip = 0, take = 101) {
		return prisma.workspaceMember.findMany({
			where: { workspaceId },
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
			orderBy: { createdAt: "asc" },
			skip,
			take,
		})
	},

	async listByUser(userId: string, skip = 0, take = 101) {
		return prisma.workspaceMember.findMany({
			where: { userId },
			include: { workspace: true },
			orderBy: { createdAt: "desc" },
			skip,
			take,
		})
	},

	async addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
		return prisma.$transaction(async (tx) => {
			await assertMemberCapacityTx(tx, workspaceId)
			return tx.workspaceMember.create({
				data: { workspaceId, userId, role },
			})
		})
	},

	async updateMemberRole(
		workspaceId: string,
		userId: string,
		role: WorkspaceRole,
	) {
		return prisma.workspaceMember.update({
			where: { userId_workspaceId: { userId, workspaceId } },
			data: { role },
		})
	},

	async removeMember(workspaceId: string, userId: string) {
		return prisma.workspaceMember.delete({
			where: { userId_workspaceId: { userId, workspaceId } },
		})
	},
}

import { workspaceRepository } from "./workspace.repository.ts"
import { NotFoundError, ForbiddenError } from "@/common/errors/app-error.ts"
import type { Prisma } from "@prisma/client"

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
}

export const workspaceService = {
	async create(name: string, ownerId: string) {
		// Append random suffix to avoid slug collisions without a DB round-trip
		const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`
		return workspaceRepository.create({ name, slug, ownerId })
	},

	async findById(workspaceId: string) {
		const workspace = await workspaceRepository.findById(workspaceId)
		if (!workspace) throw new NotFoundError("Workspace not found")
		return workspace
	},

	async listByUser(userId: string) {
		const memberships = await workspaceRepository.listByUser(userId)
		return memberships.map((m) => ({ ...m.workspace, role: m.role }))
	},

	async update(workspaceId: string, data: Prisma.WorkspaceUpdateInput) {
		return workspaceRepository.update(workspaceId, data)
	},

	async delete(workspaceId: string) {
		return workspaceRepository.delete(workspaceId)
	},

	async assertMembership(workspaceId: string, userId: string) {
		const member = await workspaceRepository.findMember(workspaceId, userId)
		if (!member) throw new ForbiddenError("Not a member of this workspace")
		return member
	},

	async assertAdmin(workspaceId: string, userId: string) {
		const member = await this.assertMembership(workspaceId, userId)
		if (member.role !== "OWNER" && member.role !== "ADMIN") {
			throw new ForbiddenError("Admin privileges required")
		}
		return member
	},

	async listMembers(workspaceId: string) {
		return workspaceRepository.listMembers(workspaceId)
	},
}

import { workspaceRepository } from "./workspace.repository.ts"
import { NotFoundError, ForbiddenError } from "@/common/errors/app-error.ts"
import type { Prisma } from "@prisma/client"

import crypto from "node:crypto"

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
}

export const workspaceService = {
	async create(name: string, ownerId: string) {
		// Append cryptographically random suffix to avoid slug collisions
		const randomSuffix = crypto.randomBytes(4).toString("hex")
		const slug = `${slugify(name)}-${randomSuffix}`
		return workspaceRepository.create({ name, slug, ownerId })
	},

	async findById(workspaceId: string) {
		const workspace = await workspaceRepository.findById(workspaceId)
		if (!workspace) throw new NotFoundError("Workspace not found")
		return workspace
	},

	async listByUser(userId: string, skip = 0, take = 101) {
		const memberships = await workspaceRepository.listByUser(userId, skip, take)
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

	async listMembers(workspaceId: string, skip = 0, take = 101) {
		return workspaceRepository.listMembers(workspaceId, skip, take)
	},
}

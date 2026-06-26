import { prisma } from "@/shared/database/prisma.ts"
import type { CreateApiKeyInput, UpdateApiKeyInput } from "./apikey.schema.ts"

export const apiKeyRepository = {
	async create(
		data: CreateApiKeyInput & {
			keyHash: string
			prefix: string
		},
	) {
		return prisma.apiKey.create({
			data: {
				name: data.name,
				keyHash: data.keyHash,
				prefix: data.prefix,
				workspaceId: data.workspaceId,

				...(data.expiresAt !== undefined && {
					expiresAt: data.expiresAt,
				}),
			},
		})
	},

	async findById(id: string) {
		return prisma.apiKey.findUnique({
			where: {
				id,
			},
		})
	},

	async findByPrefix(prefix: string) {
		return prisma.apiKey.findUnique({
			where: {
				prefix,
			},
		})
	},

	async findMany(workspaceId: string, skip: number, take: number) {
		return prisma.apiKey.findMany({
			where: {
				workspaceId,
			},

			skip,
			take,

			orderBy: {
				createdAt: "desc",
			},
		})
	},

	async count(workspaceId: string) {
		return prisma.apiKey.count({
			where: {
				workspaceId,
			},
		})
	},

	async update(id: string, data: UpdateApiKeyInput) {
		return prisma.apiKey.update({
			where: {
				id,
			},

			data: {
				...(data.name !== undefined && {
					name: data.name,
				}),

				...(data.isActive !== undefined && {
					isActive: data.isActive,
				}),

				...(data.expiresAt !== undefined && {
					expiresAt: data.expiresAt,
				}),
			},
		})
	},

	async updateLastUsed(id: string) {
		return prisma.apiKey.update({
			where: {
				id,
			},

			data: {
				lastUsedAt: new Date(),
			},
		})
	},

	async revoke(id: string) {
		return prisma.apiKey.update({
			where: {
				id,
			},

			data: {
				isActive: false,
			},
		})
	},
}

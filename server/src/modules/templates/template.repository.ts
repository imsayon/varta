import { prisma } from "@/shared/database/prisma.ts"

import type {
	CreateTemplateInput,
	UpdateTemplateInput,
} from "./template.schema.ts"

export const templateRepository = {
	async create(data: CreateTemplateInput & { workspaceId: string }) {
		return prisma.template.create({
			data: {
				name: data.name,
				description: data.description ?? null,
				channels: data.channels as any, // mapping JSON
				digestConfig: data.digestConfig as any ?? null,
				aiPersonalize: data.aiPersonalize ?? false,
				workspaceId: data.workspaceId,
			},
		})
	},

	async findById(id: string) {
		return prisma.template.findUnique({
			where: {
				id,
			},
		})
	},

	async findByName(workspaceId: string, name: string) {
		return prisma.template.findUnique({
			where: {
				workspaceId_name: {
					workspaceId,
					name,
				},
			},
		})
	},

	async findMany(
		workspaceId: string,
		skip: number,
		take: number,
		search?: string,
	) {
		return prisma.template.findMany({
			where: {
				workspaceId,

				...(search && {
					OR: [
						{
							name: {
								contains: search,
								mode: "insensitive",
							},
						},
						{
							description: {
								contains: search,
								mode: "insensitive",
							},
						},
					],
				}),
			},

			skip,
			take,

			orderBy: {
				createdAt: "desc",
			},
		})
	},

	async count(workspaceId: string, search?: string) {
		return prisma.template.count({
			where: {
				workspaceId,

				...(search && {
					OR: [
						{
							name: {
								contains: search,
								mode: "insensitive",
							},
						},
						{
							description: {
								contains: search,
								mode: "insensitive",
							},
						},
					],
				}),
			},
		})
	},

	async update(id: string, data: UpdateTemplateInput) {
		return prisma.template.update({
			where: {
				id,
			},

			data: {
				...(data.name !== undefined && {
					name: data.name,
				}),

				...(data.description !== undefined && {
					description: data.description,
				}),

				...(data.channels !== undefined && {
					channels: data.channels as any,
				}),

				...(data.digestConfig !== undefined && {
					digestConfig: data.digestConfig as any,
				}),

				...(data.aiPersonalize !== undefined && {
					aiPersonalize: data.aiPersonalize,
				}),
				
				...(data.isActive !== undefined && {
					isActive: data.isActive,
				}),
			},
		})
	},

	async delete(id: string) {
		return prisma.template.delete({
			where: {
				id,
			},
		})
	},
}

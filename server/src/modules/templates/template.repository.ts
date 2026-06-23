import { prisma } from "@/shared/database/prisma.ts"

import type {
	CreateTemplateInput,
	UpdateTemplateInput,
} from "./template.schema.ts"

export const templateRepository = {
	async create(data: CreateTemplateInput) {
		return prisma.template.create({
			data: {
				name: data.name,
				body: data.body,
				channel: data.channel,
				workspaceId: data.workspaceId,

				...(data.subject !== undefined && {
					subject: data.subject,
				}),
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
							subject: {
								contains: search,
								mode: "insensitive",
							},
						},
						{
							body: {
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
							subject: {
								contains: search,
								mode: "insensitive",
							},
						},
						{
							body: {
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

				...(data.subject !== undefined && {
					subject: data.subject,
				}),

				...(data.body !== undefined && {
					body: data.body,
				}),

				...(data.channel !== undefined && {
					channel: data.channel,
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

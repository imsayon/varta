import { templateRepository } from "./template.repository.ts"

import { ConflictError, NotFoundError } from "@/shared/error/error.ts"

import type {
	CreateTemplateInput,
	UpdateTemplateInput,
	TemplateQuery,
} from "./template.schema.ts"

export const templateService = {
	async create(data: CreateTemplateInput) {
		const existingTemplate = await templateRepository.findByName(
			data.workspaceId,
			data.name,
		)

		if (existingTemplate) {
			throw new ConflictError(
				`Template '${data.name}' already exists in this workspace`,
			)
		}

		return templateRepository.create(data)
	},

	async getById(id: string) {
		const template = await templateRepository.findById(id)

		if (!template) {
			throw new NotFoundError("Template not found")
		}

		return template
	},

	async getAll(workspaceId: string, query: TemplateQuery) {
		const page = query.page ?? 1
		const limit = query.limit ?? 10
		const search = query.search

		const skip = (page - 1) * limit

		const [templates, total] = await Promise.all([
			templateRepository.findMany(workspaceId, skip, limit, search),
			templateRepository.count(workspaceId, search),
		])

		return {
			data: templates,

			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		}
	},

	async update(id: string, data: UpdateTemplateInput) {
		const existingTemplate = await templateRepository.findById(id)

		if (!existingTemplate) {
			throw new NotFoundError("Template not found")
		}

		if (data.name && data.name !== existingTemplate.name) {
			const duplicateTemplate = await templateRepository.findByName(
				existingTemplate.workspaceId,
				data.name,
			)

			if (duplicateTemplate) {
				throw new ConflictError(
					`Template '${data.name}' already exists in this workspace`,
				)
			}
		}

		return templateRepository.update(id, data)
	},

	async delete(id: string) {
		const existingTemplate = await templateRepository.findById(id)

		if (!existingTemplate) {
			throw new NotFoundError("Template not found")
		}

		await templateRepository.delete(id)

		return {
			success: true,
			message: "Template deleted successfully",
		}
	},
}

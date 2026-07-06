import { templateRepository } from "./template.repository.ts"
import { Prisma } from "@prisma/client"
import { templateRendererService } from "@/common/template-engine/template-renderer.service.ts"

export const templateService = {
	async create(data: Prisma.TemplateUncheckedCreateInput) {
		return templateRepository.create(data)
	},

	async update(
		workspaceId: string,
		id: string,
		data: Prisma.TemplateUncheckedUpdateInput,
	) {
		return templateRepository.update(workspaceId, id, data)
	},

	async delete(workspaceId: string, id: string) {
		return templateRepository.delete(workspaceId, id)
	},

	async search(workspaceId: string, skip: number, take: number) {
		return templateRepository.findMany(workspaceId, skip, take)
	},
	async findById(workspaceId: string, id: string) {
		return templateRepository.findById(workspaceId, id)
	},

	preview(templateString: string, payload: Record<string, unknown>): string {
		return templateRendererService.renderAndSanitize(
			templateString,
			payload,
		)
	},
}

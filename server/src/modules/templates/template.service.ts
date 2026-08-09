import { templateRepository } from "./template.repository.ts"
import { Prisma } from "@prisma/client"
import { templateRendererService } from "@/common/template-engine/template-renderer.service.ts"
import type { DecodedCursor } from "@/common/utils/pagination.ts"

export const templateService = {
	async create(data: Prisma.TemplateUncheckedCreateInput) {
		return templateRepository.create(data)
	},

	async update(
		workspaceId: string,
		id: string,
		data: Prisma.TemplateUpdateManyMutationInput,
	) {
		return templateRepository.update(workspaceId, id, data)
	},

	async delete(workspaceId: string, id: string) {
		return templateRepository.delete(workspaceId, id)
	},

	async search(workspaceId: string, take: number, cursor: DecodedCursor | null) {
		return templateRepository.findMany(workspaceId, take, cursor)
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

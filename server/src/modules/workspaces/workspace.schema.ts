import { z } from "zod"
import { jsonObjectSchema } from "@/common/types/json.ts"

export const createWorkspaceSchema = z.object({
	name: z.string().min(2).max(50),
})

export const updateWorkspaceSchema = z.object({
	name: z.string().min(2).max(50).optional(),
	settings: jsonObjectSchema.optional(),
})

import { z } from "zod"

export const createWorkspaceSchema = z.object({
	name: z.string().min(2).max(50),
})

export const updateWorkspaceSchema = z.object({
	name: z.string().min(2).max(50).optional(),
	settings: z.record(z.string(), z.any()).optional(),
})

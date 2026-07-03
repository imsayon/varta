import { z } from "zod"

export const createApiKeySchema = z.object({
	name: z.string().min(2).max(50),
	permissions: z.record(z.string(), z.any()).optional(),
})

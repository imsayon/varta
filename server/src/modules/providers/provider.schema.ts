import { z } from "zod"
import { jsonObjectSchema } from "@/common/types/json.ts"

export const upsertProviderConfigSchema = z.object({
	provider: z.string().min(1),
	config: jsonObjectSchema,
	isActive: z.boolean().optional().default(true),
})

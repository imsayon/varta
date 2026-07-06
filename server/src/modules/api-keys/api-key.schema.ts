import { z } from "zod"
import { jsonObjectSchema } from "@/common/types/json.ts"

export const createApiKeySchema = z.object({
	name: z.string().min(2).max(50),
	permissions: jsonObjectSchema.optional(),
})

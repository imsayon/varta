import { z } from "zod";

export const upsertProviderConfigSchema = z.object({
	provider: z.string().min(1),
	config: z.record(z.string(), z.any()),
	isActive: z.boolean().optional()
});

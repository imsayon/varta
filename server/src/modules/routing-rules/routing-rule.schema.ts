import { z } from "zod"
import { jsonObjectSchema } from "@/common/types/json.ts"
import { NotificationChannel } from "../notifications/notification.types.ts"

export const routingRuleConditionSchema = z.object({
	field: z.string().min(1),
	op: z.enum(["eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in", "exists", "contains"]),
	value: z.unknown().optional(),
})

export const routingRuleAstSchema = z.object({
	logic: z.enum(["AND", "OR"]).default("AND"),
	conditions: z.array(routingRuleConditionSchema).default([]),
	channels: z.array(z.enum(NotificationChannel)).min(1),
	fallback: z
		.object({
			channels: z.array(z.enum(NotificationChannel)).min(1),
		})
		.nullable()
		.optional(),
})

export const compileRoutingRuleSchema = z.object({
	naturalLanguage: z.string().trim().min(5).max(2000),
})

export type RoutingRuleAst = z.infer<typeof routingRuleAstSchema>

export const createRoutingRuleSchema = z.object({
	name: z.string().min(1).max(255),
	naturalLanguage: z.string().max(2000).optional().nullable(),
	ruleAst: routingRuleAstSchema,
	priority: z.coerce.number().int().min(0).default(0).optional(),
	isActive: z.boolean().optional(),
})

export const updateRoutingRuleSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	naturalLanguage: z.string().max(2000).optional().nullable(),
	ruleAst: routingRuleAstSchema.optional(),
	priority: z.coerce.number().int().min(0).optional(),
	isActive: z.boolean().optional(),
})

export const listRoutingRulesQuerySchema = z.object({
	workspaceId: z.string().optional(),
})

export type CreateRoutingRuleRequest = z.infer<typeof createRoutingRuleSchema>
export type UpdateRoutingRuleRequest = z.infer<typeof updateRoutingRuleSchema>

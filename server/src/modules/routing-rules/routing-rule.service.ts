import type { Prisma } from "@prisma/client"
import { BadRequestError, NotFoundError } from "@/common/errors/app-error.ts"
import { NotificationChannel } from "../notifications/notification.types.ts"
import { routingRuleRepository } from "./routing-rule.repository.ts"
import {
	createRoutingRuleSchema,
	routingRuleAstSchema,
	updateRoutingRuleSchema,
	type RoutingRuleAst,
} from "./routing-rule.schema.ts"
import { matchesRoutingRule } from "./routing-rule.evaluator.ts"

type SubscriberRoutingContext = {
	attributes: unknown
	preferences: unknown
}

const preferenceKeys: Record<NotificationChannel, string> = {
	[NotificationChannel.EMAIL]: "email",
	[NotificationChannel.IN_APP]: "inapp",
	[NotificationChannel.WEBHOOK]: "webhook",
}

const templateChannelKeys: Record<string, NotificationChannel> = {
	email: NotificationChannel.EMAIL,
	inapp: NotificationChannel.IN_APP,
	webhook: NotificationChannel.WEBHOOK,
}

function availableChannels(templateChannels: unknown): NotificationChannel[] {
	if (!templateChannels || typeof templateChannels !== "object" || Array.isArray(templateChannels)) return []
	return Object.keys(templateChannels)
		.map((channel) => templateChannelKeys[channel.toLowerCase()])
		.filter((channel): channel is NotificationChannel => channel !== undefined)
}

function preferenceAllows(preferences: unknown, channel: NotificationChannel): boolean {
	if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return true
	return (preferences as Record<string, unknown>)[preferenceKeys[channel]] !== false
}

function parseRuleAst(value: unknown): RoutingRuleAst {
	const result = routingRuleAstSchema.safeParse(value)
	if (!result.success) throw new BadRequestError("Invalid routing rule AST")
	return result.data
}

export const routingRuleService = {
	async list(workspaceId: string, skip?: number, take?: number) {
		return routingRuleRepository.list(workspaceId, skip, take)
	},

	async create(workspaceId: string, input: unknown) {
		const data = createRoutingRuleSchema.parse(input)
		return routingRuleRepository.create({
			workspaceId,
			name: data.name,
			naturalLanguage: data.naturalLanguage ?? null,
			ruleAst: parseRuleAst(data.ruleAst) as Prisma.InputJsonValue,
			priority: data.priority ?? 0,
			isActive: data.isActive ?? true,
		})
	},

	async update(workspaceId: string, id: string, input: unknown) {
		const data = updateRoutingRuleSchema.parse(input)
		const updated = await routingRuleRepository.update(workspaceId, id, {
			...(data.name !== undefined ? { name: data.name } : {}),
			...(data.naturalLanguage !== undefined ? { naturalLanguage: data.naturalLanguage } : {}),
			...(data.ruleAst !== undefined ? { ruleAst: parseRuleAst(data.ruleAst) as Prisma.InputJsonValue } : {}),
			...(data.priority !== undefined ? { priority: data.priority } : {}),
			...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
		})
		if (!updated) throw new NotFoundError("Routing rule not found")
		return updated
	},

	async remove(workspaceId: string, id: string) {
		const deleted = await routingRuleRepository.delete(workspaceId, id)
		if (!deleted) throw new NotFoundError("Routing rule not found")
	},

	async resolveChannels(
		workspaceId: string,
		subscriber: SubscriberRoutingContext,
		templateChannels: unknown,
		requestedChannels?: NotificationChannel[],
	): Promise<NotificationChannel[]> {
		const available = availableChannels(templateChannels)
		const rules = await routingRuleRepository.list(workspaceId)
		const matchingRule = rules.find(
			(rule) => rule.isActive && matchesRoutingRule(rule.ruleAst, subscriber),
		)
		const configured = matchingRule
			? parseRuleAst(matchingRule.ruleAst).channels
			: requestedChannels?.length
				? requestedChannels
				: available
		const selected = configured.filter(
			(channel, index) =>
				available.includes(channel) &&
				configured.indexOf(channel) === index &&
				preferenceAllows(subscriber.preferences, channel),
		)
		if (selected.length === 0) throw new BadRequestError("No delivery channels are available")
		return selected
	},
}

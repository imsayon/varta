import { z } from "zod"
import { aiGateway } from "@/infra/ai/ai.gateway.ts"
import { BadRequestError } from "@/common/errors/app-error.ts"
import { routingRuleAstSchema, type RoutingRuleAst } from "./routing-rule.schema.ts"
import { AI_FEATURES, AI_PROMPT_VERSIONS } from "@/infra/ai/ai.constants.ts"

const compilerOutputSchema = z.object({
	ast: routingRuleAstSchema,
	explanation: z.string().max(500).optional(),
})

const ALLOWED_FIELD_PREFIXES = ["subscriber.attributes.", "subscriber.preferences."] as const

function validateFields(ast: RoutingRuleAst): RoutingRuleAst {
	for (const condition of ast.conditions) {
		if (!ALLOWED_FIELD_PREFIXES.some((prefix) => condition.field.startsWith(prefix))) {
			throw new BadRequestError("Compiled rules may only read subscriber attributes or preferences.")
		}
	}
	return ast
}

export const routingRuleCompiler = {
	async compile(workspaceId: string, naturalLanguage: string) {
		const response = await aiGateway.generate({
			workspaceId,
			feature: AI_FEATURES.ROUTING_COMPILER,
			input: naturalLanguage,
			promptVersion: AI_PROMPT_VERSIONS.ROUTING_COMPILER_V1,
			outputSchema: compilerOutputSchema,
		})
		const result = response.data
		return { ast: validateFields(result.ast), explanation: result.explanation }
	},
}

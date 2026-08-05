import { readFile } from "node:fs/promises"
import path from "node:path"
import { env } from "@/common/config/env.ts"
import type { PromptDocument } from "./prompt.types.ts"

export const promptRepository = {
	async find(version: string): Promise<PromptDocument> {
		const content = await readFile(
			path.resolve(
				process.cwd(),
				env.AI_PROMPT_DIRECTORY,
				`${version}.system.md`,
			),
			"utf8",
		)
		return { version, content }
	},
}

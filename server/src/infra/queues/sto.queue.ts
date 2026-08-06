import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

export const sendTimeOptimizationQueue = createQueue<{ version: 1; workspaceId: string }>(
	QueueNames.SYSTEM,
)

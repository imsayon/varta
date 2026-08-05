import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

export const sendTimeOptimizationQueue = createQueue<{ workspaceId: string }>(
	QueueNames.SYSTEM,
)

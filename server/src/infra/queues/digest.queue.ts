import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

export interface ProcessDigestJobDto {
	version: 1
	workspaceId: string
	batchId: string
}

export const digestQueue = createQueue<ProcessDigestJobDto>(QueueNames.DIGEST)

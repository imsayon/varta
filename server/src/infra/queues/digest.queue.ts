import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

export interface ProcessDigestJobDto {
	batchId: string
}

export const digestQueue = createQueue<ProcessDigestJobDto>(QueueNames.DIGEST)

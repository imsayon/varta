import { Queue } from "bullmq"
import { getQueueConnection } from "./queue.connection.ts"
import { DEFAULT_JOB_OPTIONS } from "./queue.options.ts"
import type { QueueNames } from "./queue.constants.ts"

export function createQueue<T = any>(queueName: QueueNames): Queue<T> {
	return new Queue<T>(queueName, {
		connection: getQueueConnection(),
		defaultJobOptions: DEFAULT_JOB_OPTIONS,
	})
}

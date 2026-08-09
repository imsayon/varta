import { Queue } from "bullmq"
import { getQueueConnection } from "./queue.connection.ts"
import { DEFAULT_JOB_OPTIONS } from "./queue.options.ts"
import type { QueueNames } from "./queue.constants.ts"
import { queueJobs, queueOldestJobSeconds } from "@/infra/observability/metrics.ts"

const queues = new Set<Queue<unknown>>()

export function createQueue<T = unknown>(queueName: QueueNames): Queue<T> {
	const queue = new Queue<T>(queueName, {
		connection: getQueueConnection(),
		defaultJobOptions: DEFAULT_JOB_OPTIONS,
	})
	queues.add(queue as unknown as Queue<unknown>)
	return queue
}

export async function closeQueues(): Promise<void> {
	const registeredQueues = [...queues]
	queues.clear()
	const results = await Promise.allSettled(
		registeredQueues.map((queue) => queue.close()),
	)
	const failures = results
		.filter((result): result is PromiseRejectedResult => result.status === "rejected")
		.map((result) => result.reason)
	if (failures.length > 0) throw new AggregateError(failures, "Queue shutdown failed")
}

export async function snapshotQueueMetrics(): Promise<void> {
	await Promise.all([...queues].map(async (queue) => {
		const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed")
		for (const [state, count] of Object.entries(counts)) {
			queueJobs.set({ queue: queue.name, state }, count)
		}
		const [oldest] = await queue.getJobs(["waiting", "delayed"], 0, 0, true)
		queueOldestJobSeconds.set(
			{ queue: queue.name },
			oldest ? Math.max(0, (Date.now() - oldest.timestamp) / 1_000) : 0,
		)
	}))
}

import { Worker } from "bullmq"
import { getQueueConnection, getQueuePrefix } from "@/infra/queues/queue.connection.ts"
import { sendTimeOptimizationQueue } from "@/infra/queues/sto.queue.ts"
import { sendTimeOptimizationService } from "@/modules/ai/send-time-optimization.service.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { logger } from "@/infra/observability/logger.ts"
import { STOJobSchema } from "@/infra/queues/payloads.ts"

export const sendTimeOptimizationWorker = new Worker<{ version: 1; workspaceId: string }>(
	"system-queue",
	async (job) => {
		const payload = STOJobSchema.parse(job.data)
		return sendTimeOptimizationService.recomputeWorkspace(payload.workspaceId)
	},
	{ connection: getQueueConnection(), prefix: getQueuePrefix() },
)

sendTimeOptimizationWorker.on("failed", (job, error) =>
	logger.error({ jobId: job?.id, err: error }, "STO vector job failed"),
)

export async function startWorkerModule(): Promise<void> {
	const workspaces = await prisma.workspace.findMany({ select: { id: true } })
	for (let index = 0; index < workspaces.length; index += 1) {
		const workspace = workspaces[index]
		if (!workspace) continue
		const delayOffset = index * 60_000
		await sendTimeOptimizationQueue.upsertJobScheduler(
			`sto-${workspace.id}`,
			{ every: 86_400_000, offset: delayOffset },
			{
				name: "nightly",
				data: { version: 1, workspaceId: workspace.id },
			},
		)
	}
}

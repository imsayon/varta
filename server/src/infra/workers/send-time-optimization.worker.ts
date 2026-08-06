import { Worker } from "bullmq"
import { getQueueConnection } from "@/infra/queues/queue.connection.ts"
import { sendTimeOptimizationQueue } from "@/infra/queues/sto.queue.ts"
import { sendTimeOptimizationService } from "@/modules/ai/send-time-optimization.service.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { logger } from "@/infra/observability/logger.ts"

export const sendTimeOptimizationWorker = new Worker<{ workspaceId: string }>(
	"system-queue",
	async (job) =>
		sendTimeOptimizationService.recomputeWorkspace(job.data.workspaceId),
	{ connection: getQueueConnection() },
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
		await sendTimeOptimizationQueue.add(
			"nightly",
			{ workspaceId: workspace.id },
			{
				jobId: `sto-${workspace.id}`,
				repeat: { every: 86_400_000, offset: delayOffset },
			} as unknown as import("bullmq").JobsOptions,
		)
	}
}

import { logger } from "@/infra/observability/logger.ts"
import type { Worker } from "bullmq"
import { activeWorkerJobs, queueFailures, queueJobs } from "@/infra/observability/metrics.ts"
import { snapshotQueueMetrics } from "@/infra/queues/queue.factory.ts"
import { env } from "@/common/config/env.ts"

type WorkerHandle = Pick<Worker, "close" | "waitUntilReady"> & Partial<Pick<Worker, "on" | "name">>
type WorkerModule = Record<string, unknown>
export type WorkerModuleLoader = () => Promise<WorkerModule>

const workers: WorkerHandle[] = []
const workerReadiness = new Map<WorkerHandle, boolean>()
let metricsTimer: NodeJS.Timeout | undefined
export const workerState = {
	status: "not_started" as
		| "not_started"
		| "starting"
		| "ready"
		| "failed"
		| "stopping"
		| "stopped",
	error: null as string | null,
}

function recomputeWorkerState(): void {
	if (["stopping", "stopped", "not_started"].includes(workerState.status)) return
	if ([...workerReadiness.values()].every(Boolean)) {
		workerState.status = "ready"
		workerState.error = null
	}
}

async function waitForWorker(
	worker: WorkerHandle,
	timeoutMs: number,
): Promise<void> {
	let timer: NodeJS.Timeout | undefined
	try {
		await Promise.race([
			worker.waitUntilReady(),
			new Promise<never>((_resolve, reject) => {
				timer = setTimeout(
					() => reject(new Error(`Worker startup exceeded ${timeoutMs}ms`)),
					timeoutMs,
				)
			}),
		])
	} finally {
		if (timer) clearTimeout(timer)
	}
}

// Workers are imported for their BullMQ side effects.
const defaultLoaders: WorkerModuleLoader[] = [
	() => import("./outbox.worker.ts"),
	() => import("./email.worker.ts"),
	() => import("./inapp.worker.ts"),
	() => import("./webhook.worker.ts"),
	() => import("./digest.worker.ts"),
	() => import("./send-time-optimization.worker.ts"),
	() => import("./reconciliation.worker.ts"),
	() => import("./billing.worker.ts"),
]

function collectWorkers(module: WorkerModule): number {
	let collected = 0
	for (const value of Object.values(module)) {
		if (value && typeof value === "object") {
			const candidate = value as {
				close?: unknown
				waitUntilReady?: unknown
			}
			if (
				typeof candidate.close === "function" &&
				typeof candidate.waitUntilReady === "function"
			) {
				workers.push(value as WorkerHandle)
				const worker = value as WorkerHandle
				workerReadiness.set(worker, false)
				if (worker.on && worker.name) {
					worker.on("ready", () => {
						workerReadiness.set(worker, true)
						recomputeWorkerState()
					})
					worker.on("error", (error: Error) => {
						workerReadiness.set(worker, false)
						workerState.status = "failed"
						workerState.error = `${worker.name}: ${error.message}`
					})
					worker.on("active", () => {
						activeWorkerJobs.inc({ queue: worker.name! })
						queueJobs.inc({ queue: worker.name!, state: "active" })
					})
					worker.on("completed", () => {
						activeWorkerJobs.dec({ queue: worker.name! })
						queueJobs.dec({ queue: worker.name!, state: "active" })
					})
					worker.on("failed", () => {
						activeWorkerJobs.dec({ queue: worker.name! })
						queueJobs.dec({ queue: worker.name!, state: "active" })
						queueFailures.inc({ queue: worker.name! })
					})
				}
				collected += 1
			}
		}
	}
	return collected
}

async function closeRegisteredWorkers(): Promise<unknown[]> {
	const registeredWorkers = workers.splice(0)
	for (const worker of registeredWorkers) workerReadiness.delete(worker)
	const results = await Promise.allSettled(
		registeredWorkers.map((worker) => worker.close()),
	)
	return results
		.filter((result): result is PromiseRejectedResult => result.status === "rejected")
		.map((result) => result.reason)
}

export async function startWorkers(
	loaders: readonly WorkerModuleLoader[] = defaultLoaders,
	startupTimeoutMs = env.STARTUP_TIMEOUT_MS,
): Promise<void> {
	if (workerState.status === "ready") return
	if (workerState.status === "starting")
		throw new Error("Background workers are already starting")

	workerState.status = "starting"
	workerState.error = null
	try {
		const modules: WorkerModule[] = []
		for (const load of loaders) {
			const module = await load()
			if (collectWorkers(module) === 0)
				throw new Error("Worker module did not export a BullMQ worker")
			modules.push(module)
		}
		await Promise.all(workers.map((worker) => waitForWorker(worker, startupTimeoutMs)))
		for (const worker of workers) workerReadiness.set(worker, true)
		for (const module of modules) {
			const startWorkerModule = module.startWorkerModule
			if (startWorkerModule !== undefined) {
				if (typeof startWorkerModule !== "function")
					throw new Error("Worker module startup hook must be a function")
				await startWorkerModule()
			}
		}
		workerState.status = "ready"
		await snapshotQueueMetrics()
		metricsTimer = setInterval(
			() => void snapshotQueueMetrics().catch((error) =>
				logger.warn({ err: error }, "Queue metric snapshot failed")),
			15_000,
		)
		logger.info("Background workers started")
	} catch (error: unknown) {
		workerState.status = "failed"
		workerState.error = error instanceof Error ? error.message : "Worker startup failed"
		const cleanupFailures = await closeRegisteredWorkers()
		if (cleanupFailures.length > 0)
			logger.error({ failures: cleanupFailures }, "Worker startup cleanup failed")
		throw error
	}
}

export async function stopWorkers(): Promise<void> {
	if (workerState.status === "not_started" || workerState.status === "stopped") return
	workerState.status = "stopping"
	if (metricsTimer) clearInterval(metricsTimer)
	metricsTimer = undefined
	const failures = await closeRegisteredWorkers()
	workerState.status = "stopped"
	workerState.error = null
	if (failures.length > 0) throw new AggregateError(failures, "Worker shutdown failed")
	logger.info("Background workers stopped")
}

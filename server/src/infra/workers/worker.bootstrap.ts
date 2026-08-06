import { logger } from "@/infra/observability/logger.ts"
import type { Worker } from "bullmq"

type WorkerHandle = Pick<Worker, "close" | "waitUntilReady">
type WorkerModule = Record<string, unknown>
export type WorkerModuleLoader = () => Promise<WorkerModule>

const workers: WorkerHandle[] = []
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

// Workers are imported for their BullMQ side effects.
const defaultLoaders: WorkerModuleLoader[] = [
	() => import("./email.worker.ts"),
	() => import("./inapp.worker.ts"),
	() => import("./webhook.worker.ts"),
	() => import("./digest.worker.ts"),
	() => import("./send-time-optimization.worker.ts"),
	() => import("./reconciliation.worker.ts"),
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
				collected += 1
			}
		}
	}
	return collected
}

async function closeRegisteredWorkers(): Promise<unknown[]> {
	const registeredWorkers = workers.splice(0)
	const results = await Promise.allSettled(
		registeredWorkers.map((worker) => worker.close()),
	)
	return results
		.filter((result): result is PromiseRejectedResult => result.status === "rejected")
		.map((result) => result.reason)
}

export async function startWorkers(
	loaders: readonly WorkerModuleLoader[] = defaultLoaders,
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
		await Promise.all(workers.map((worker) => worker.waitUntilReady()))
		for (const module of modules) {
			const startWorkerModule = module.startWorkerModule
			if (startWorkerModule !== undefined) {
				if (typeof startWorkerModule !== "function")
					throw new Error("Worker module startup hook must be a function")
				await startWorkerModule()
			}
		}
		workerState.status = "ready"
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
	const failures = await closeRegisteredWorkers()
	workerState.status = "stopped"
	workerState.error = null
	if (failures.length > 0) throw new AggregateError(failures, "Worker shutdown failed")
	logger.info("Background workers stopped")
}

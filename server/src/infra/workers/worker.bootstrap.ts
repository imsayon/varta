import { logger } from "@/infra/observability/logger.ts"
import type { Worker } from "bullmq"

const workers: Worker[] = []
export const workerState = { started: false }

// Workers are imported for their BullMQ side effects.

export async function startWorkers(): Promise<void> {
	// Step 1: Import the email worker (side-effect: registers with BullMQ)
	const modules = await Promise.all([
		import("./email.worker.ts"),
		import("./inapp.worker.ts"),
		import("./webhook.worker.ts"),
		import("./digest.worker.ts"),
		import("./send-time-optimization.worker.ts"),
		import("./reconciliation.worker.ts"),
	])
	for (const module of modules) {
		for (const value of Object.values(module)) {
			if (value && typeof value === "object" && "close" in value)
				workers.push(value as Worker)
		}
	}
	workerState.started = true
	logger.info("Background workers started")
}

export async function stopWorkers(): Promise<void> {
	workerState.started = false
	await Promise.all(workers.map((worker) => worker.close()))
	workers.length = 0
	logger.info("Background workers stopped")
}

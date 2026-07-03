import { logger } from "@/infra/logger/logger.ts"

//Start all background workers. Currently only the email worker is active.
//Add new worker imports here as channels are implemented (webhook, in-app).

export async function startWorkers(): Promise<void> {
	// Step 1: Import the email worker (side-effect: registers with BullMQ)
	await import("./email.worker.ts")
	logger.info("Background workers started")
}

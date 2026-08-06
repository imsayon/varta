export type CombinedStartupDependencies = {
	startWorkers: () => Promise<void>
	startWebSocketServer: () => void
	listen: () => Promise<void>
	stopWorkers: () => Promise<void>
}

export async function startCombinedBackend(
	dependencies: CombinedStartupDependencies,
): Promise<void> {
	try {
		await dependencies.startWorkers()
		dependencies.startWebSocketServer()
		await dependencies.listen()
	} catch (error: unknown) {
		await dependencies.stopWorkers()
		throw error
	}
}

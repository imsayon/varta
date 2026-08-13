export type CombinedStartupDependencies = {
	connectRedis: () => Promise<void>
	startWorkers: () => Promise<void>
	startWebSocketServer: () => Promise<void>
	listen: () => Promise<void>
	stopWorkers: () => Promise<void>
}

export async function startCombinedBackend(
	dependencies: CombinedStartupDependencies,
): Promise<void> {
	try {
		await dependencies.connectRedis()
		await dependencies.startWorkers()
		await dependencies.startWebSocketServer()
		await dependencies.listen()
	} catch (error: unknown) {
		await dependencies.stopWorkers()
		throw error
	}
}

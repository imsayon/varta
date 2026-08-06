import type { Server } from "node:http"

export type AsyncCleanup = () => Promise<void>
export type CleanupPhase = readonly AsyncCleanup[]

export type ShutdownResult = {
	timedOut: boolean
	failures: unknown[]
}

export function listen(server: Server, port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const onError = (error: Error) => {
			server.off("listening", onListening)
			reject(error)
		}
		const onListening = () => {
			server.off("error", onError)
			resolve()
		}

		server.once("error", onError)
		server.listen(port, onListening)
	})
}

export function closeHttpServer(server: Server): Promise<void> {
	if (!server.listening) return Promise.resolve()

	return new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error)
				return
			}
			resolve()
		})
	})
}

export async function shutdownResources(
	phases: readonly CleanupPhase[],
	timeoutMs: number,
): Promise<ShutdownResult> {
	const completion = (async (): Promise<ShutdownResult> => {
		const failures: unknown[] = []
		for (const phase of phases) {
			const results = await Promise.allSettled(
				phase.map((cleanup) => cleanup()),
			)
			failures.push(
				...results
					.filter(
						(result): result is PromiseRejectedResult =>
							result.status === "rejected",
					)
					.map((result) => result.reason),
			)
		}
		return { timedOut: false, failures }
	})()

	let timeout: NodeJS.Timeout | undefined
	const deadline = new Promise<ShutdownResult>((resolve) => {
		timeout = setTimeout(
			() => resolve({ timedOut: true, failures: [] }),
			timeoutMs,
		)
	})

	const result = await Promise.race([completion, deadline])
	if (timeout) clearTimeout(timeout)
	return result
}

import type { Server } from "node:http"

export type AsyncCleanup = () => Promise<void>

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
	cleanups: readonly AsyncCleanup[],
	timeoutMs: number,
): Promise<ShutdownResult> {
	const completion = Promise.allSettled(cleanups.map((cleanup) => cleanup())).then(
		(results) => ({
			timedOut: false as const,
			failures: results
				.filter((result): result is PromiseRejectedResult => result.status === "rejected")
				.map((result) => result.reason),
		}),
	)

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

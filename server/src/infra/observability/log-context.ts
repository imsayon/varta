import { AsyncLocalStorage } from "node:async_hooks"

export type LogIdentifiers = {
	requestId?: string
	correlationId?: string
	notificationId?: string
	deliveryId?: string
	attemptId?: string
	jobId?: string
	eventId?: string
}

const storage = new AsyncLocalStorage<LogIdentifiers>()

export function currentLogContext(): LogIdentifiers {
	return storage.getStore() ?? {}
}

export function compactLogIdentifiers(
	identifiers: Partial<Record<keyof LogIdentifiers, string | undefined>>,
): LogIdentifiers {
	return Object.fromEntries(
		Object.entries(identifiers).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	) as LogIdentifiers
}

export function withLogContext<T>(
	identifiers: LogIdentifiers,
	callback: () => T,
): T {
	return storage.run({ ...currentLogContext(), ...identifiers }, callback)
}

export const lifecycleState = {
	started: false,
	draining: false,
}

export function markStarted(): void {
	lifecycleState.started = true
	lifecycleState.draining = false
}

export function beginDrain(): void {
	lifecycleState.draining = true
}

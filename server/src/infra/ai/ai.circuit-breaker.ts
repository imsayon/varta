import { ServiceUnavailableError } from "@/common/errors/app-error.ts"

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

export interface CircuitBreakerOptions {
	failureThreshold: number
	windowMs: number
	cooldownMs: number
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
	failureThreshold: 5,
	windowMs: 60_000, // 1 minute
	cooldownMs: 30_000, // 30 seconds
}

export class AICircuitBreaker {
	private state: CircuitState = "CLOSED"
	private failures: number[] = [] // timestamps of recent failures
	private openedAt: number | null = null
	private readonly options: CircuitBreakerOptions
	private readonly now: () => number

	constructor(
		options: Partial<CircuitBreakerOptions> = {},
		now: () => number = Date.now,
	) {
		this.options = { ...DEFAULT_OPTIONS, ...options }
		this.now = now
	}

	getState(): CircuitState {
		return this.state
	}

	// Call before a provider request. Throws ServiceUnavailableError if circuit is OPEN.
	beforeRequest(): void {
		const now = this.now()
		if (this.state === "OPEN") {
			if (
				this.openedAt !== null &&
				now - this.openedAt >= this.options.cooldownMs
			) {
				this.state = "HALF_OPEN"
			} else {
				throw new ServiceUnavailableError(
					"AI provider circuit is open; feature temporarily unavailable",
				)
			}
		}
		// CLOSED or HALF_OPEN: allow the request through
	}

	// Call after a successful provider response.
	onSuccess(): void {
		this.failures = []
		this.openedAt = null
		this.state = "CLOSED"
	}

	//Call after a provider failure.
	onFailure(): void {
		const now = this.now()
		// Evict stale failures outside the window
		this.failures = this.failures.filter(
			(t) => now - t < this.options.windowMs,
		)
		this.failures.push(now)

		if (this.state === "HALF_OPEN") {
			// Probe failed — return to OPEN
			this.state = "OPEN"
			this.openedAt = now
		} else if (this.failures.length >= this.options.failureThreshold) {
			this.state = "OPEN"
			this.openedAt = now
		}
	}
}

const circuits = new Map<string, AICircuitBreaker>()

export function getAICircuitBreaker(
	provider: string,
	model: string,
): AICircuitBreaker {
	const key = `${provider}:${model}`
	let circuit = circuits.get(key)
	if (!circuit) {
		circuit = new AICircuitBreaker()
		circuits.set(key, circuit)
	}
	return circuit
}

/**
 * E4: Simple in-process circuit breaker for the AI gateway.
 *
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (probe)
 *
 * - While CLOSED: requests pass through; failures are counted.
 * - OPEN after failureThreshold failures within windowMs.
 * - Stays OPEN for cooldownMs, then moves to HALF_OPEN for one probe.
 * - HALF_OPEN: if the probe succeeds, circuit closes; if it fails, returns to OPEN.
 *
 * When OPEN, callers receive a ServiceUnavailableError immediately (no provider call).
 * This ensures AI unavailability never blocks notification delivery.
 */

import { ServiceUnavailableError } from "@/common/errors/app-error.ts"

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

export interface CircuitBreakerOptions {
	/** Number of failures in windowMs to trip the circuit */
	failureThreshold: number
	/** Sliding window for counting failures, in milliseconds */
	windowMs: number
	/** How long to stay OPEN before attempting a probe, in milliseconds */
	cooldownMs: number
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
	failureThreshold: 5,
	windowMs: 60_000,   // 1 minute
	cooldownMs: 30_000, // 30 seconds
}

export class AICircuitBreaker {
	private state: CircuitState = "CLOSED"
	private failures: number[] = [] // timestamps of recent failures
	private openedAt: number | null = null
	private readonly options: CircuitBreakerOptions

	constructor(options: Partial<CircuitBreakerOptions> = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options }
	}

	getState(): CircuitState {
		return this.state
	}

	/** Call before a provider request. Throws ServiceUnavailableError if circuit is OPEN. */
	beforeRequest(): void {
		const now = Date.now()
		if (this.state === "OPEN") {
			if (this.openedAt !== null && now - this.openedAt >= this.options.cooldownMs) {
				this.state = "HALF_OPEN"
			} else {
				throw new ServiceUnavailableError(
					"AI provider circuit is open; feature temporarily unavailable",
				)
			}
		}
		// CLOSED or HALF_OPEN: allow the request through
	}

	/** Call after a successful provider response. */
	onSuccess(): void {
		this.failures = []
		this.openedAt = null
		this.state = "CLOSED"
	}

	/** Call after a provider failure. */
	onFailure(): void {
		const now = Date.now()
		// Evict stale failures outside the window
		this.failures = this.failures.filter((t) => now - t < this.options.windowMs)
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

	/** Reset to CLOSED (for testing and operator manual recovery). */
	reset(): void {
		this.state = "CLOSED"
		this.failures = []
		this.openedAt = null
	}
}

// Singleton circuit breaker for the AI gateway.
// One circuit per process — acceptable for the single-combined-service topology.
export const aiCircuitBreaker = new AICircuitBreaker()

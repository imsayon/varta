import {
	Counter,
	Gauge,
	Histogram,
	Registry,
	collectDefaultMetrics,
} from "prom-client"

export const metricsRegistry = new Registry()
collectDefaultMetrics({ register: metricsRegistry, prefix: "varta_process_" })

export const httpRequests = new Counter({
	name: "varta_http_requests_total",
	help: "Total HTTP requests",
	labelNames: ["method", "route", "status"] as const,
	registers: [metricsRegistry],
})

export const httpDuration = new Histogram({
	name: "varta_http_request_duration_seconds",
	help: "HTTP request duration in seconds",
	labelNames: ["method", "route"] as const,
	buckets: [0.005, 0.025, 0.1, 0.25, 0.5, 1, 2, 5],
	registers: [metricsRegistry],
})

export const deliveryAttempts = new Counter({
	name: "varta_delivery_attempts_total",
	help: "Delivery attempts by outcome",
	labelNames: ["channel", "outcome"] as const,
	registers: [metricsRegistry],
})

export const deliveryDuration = new Histogram({
	name: "varta_delivery_duration_seconds",
	help: "Delivery duration in seconds",
	labelNames: ["channel"] as const,
	registers: [metricsRegistry],
})

export const queueJobs = new Gauge({
	name: "varta_queue_jobs",
	help: "BullMQ jobs observed by state",
	labelNames: ["queue", "state"] as const,
	registers: [metricsRegistry],
})

export const queueFailures = new Counter({
	name: "varta_queue_failures_total",
	help: "BullMQ jobs that failed",
	labelNames: ["queue", "reason"] as const,
	registers: [metricsRegistry],
})

export const outboxLagSeconds = new Gauge({
	name: "varta_outbox_oldest_eligible_seconds",
	help: "Age of the oldest outbox intent eligible for dispatch",
	registers: [metricsRegistry],
})

export const outboxLeases = new Gauge({
	name: "varta_outbox_leases_active",
	help: "Outbox intents leased by the current dispatcher batch",
	registers: [metricsRegistry],
})

export const outboxFailures = new Counter({
	name: "varta_outbox_publish_failures_total",
	help: "Outbox publication failures",
	labelNames: ["channel"] as const,
	registers: [metricsRegistry],
})

export const activeWorkerJobs = new Gauge({
	name: "varta_worker_jobs_active",
	help: "Active worker jobs",
	labelNames: ["queue"] as const,
	registers: [metricsRegistry],
})

export const activeWebSockets = new Gauge({
	name: "varta_ws_connections_active",
	help: "Active WebSocket connections",
	registers: [metricsRegistry],
})

export function observeHttp(
	method: string,
	route: string,
	status: number,
	seconds: number,
): void {
	httpRequests.inc({ method, route, status: String(status) })
	httpDuration.observe({ method, route }, seconds)
}

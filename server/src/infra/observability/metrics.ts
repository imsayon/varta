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
	labelNames: ["method", "route", "status_class"] as const,
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
	labelNames: ["queue"] as const,
	registers: [metricsRegistry],
})

export const queueOldestJobSeconds = new Gauge({
	name: "varta_queue_oldest_job_seconds",
	help: "Age of the oldest waiting or delayed job",
	labelNames: ["queue"] as const,
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

export const notificationAcceptance = new Counter({
	name: "varta_notification_acceptance_total",
	help: "Durable notification acceptance outcomes",
	labelNames: ["outcome"] as const,
	registers: [metricsRegistry],
})

export const dependencyReady = new Gauge({
	name: "varta_dependency_ready",
	help: "Required dependency readiness (1 ready, 0 unavailable)",
	labelNames: ["dependency"] as const,
	registers: [metricsRegistry],
})

export const databasePoolConnections = new Gauge({
	name: "varta_database_pool_connections",
	help: "PostgreSQL pool connections by state",
	labelNames: ["state"] as const,
	registers: [metricsRegistry],
})

export const providerRequests = new Counter({
	name: "varta_provider_requests_total",
	help: "Provider requests by bounded provider, channel, and outcome",
	labelNames: ["provider", "channel", "outcome"] as const,
	registers: [metricsRegistry],
})

export const providerDuration = new Histogram({
	name: "varta_provider_request_duration_seconds",
	help: "Provider request duration in seconds",
	labelNames: ["provider", "channel"] as const,
	buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
	registers: [metricsRegistry],
})

export const reconciliationRuns = new Counter({
	name: "varta_reconciliation_runs_total",
	help: "Reconciliation runs by outcome",
	labelNames: ["outcome"] as const,
	registers: [metricsRegistry],
})

export const reconciliationLastSuccess = new Gauge({
	name: "varta_reconciliation_last_success_unixtime",
	help: "Unix timestamp of the last successful notification reconciliation run",
	registers: [metricsRegistry],
})

reconciliationLastSuccess.set(0)

export const realtimeEvents = new Counter({
	name: "varta_realtime_events_total",
	help: "Realtime events by bounded event and outcome",
	labelNames: ["event", "outcome"] as const,
	registers: [metricsRegistry],
})

export const aiRequests = new Counter({
	name: "varta_ai_requests_total",
	help: "AI requests by feature and outcome",
	labelNames: ["feature", "outcome"] as const,
	registers: [metricsRegistry],
})

export const aiDuration = new Histogram({
	name: "varta_ai_request_duration_seconds",
	help: "AI request duration by feature",
	labelNames: ["feature"] as const,
	registers: [metricsRegistry],
})

export const aiTokens = new Counter({
	name: "varta_ai_tokens_total",
	help: "AI tokens by direction",
	labelNames: ["direction"] as const,
	registers: [metricsRegistry],
})

export const aiGatewayRequests = new Counter({
	name: "varta_ai_gateway_requests_total",
	help: "AI gateway requests by bounded production contract",
	labelNames: ["provider", "model", "feature", "prompt_version", "outcome"] as const,
	registers: [metricsRegistry],
})

export const aiGatewayDuration = new Histogram({
	name: "varta_ai_gateway_duration_seconds",
	help: "AI gateway duration by bounded production contract",
	labelNames: ["provider", "model", "feature", "prompt_version"] as const,
	buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
	registers: [metricsRegistry],
})

export const aiCircuitOpen = new Gauge({
	name: "varta_ai_circuit_open",
	help: "Whether an AI provider/model circuit is open",
	labelNames: ["provider", "model"] as const,
	registers: [metricsRegistry],
})

export const billingEvents = new Counter({
	name: "varta_billing_events_total",
	help: "Billing events by bounded event and outcome",
	labelNames: ["event", "outcome"] as const,
	registers: [metricsRegistry],
})

export const billingInboxOldestSeconds = new Gauge({
	name: "varta_billing_inbox_oldest_pending_seconds",
	help: "Age of the oldest processable billing inbox event",
	registers: [metricsRegistry],
})

export const billingSubscriptionDrift = new Gauge({
	name: "varta_billing_subscription_drift",
	help: "Whether the last reconciliation observed provider/local subscription drift",
	registers: [metricsRegistry],
})

const IDENTIFIER_SEGMENT = /^(?:\d+|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|(?:req|ws|sub|tpl|notif|del|evt|key)_[A-Za-z0-9_-]+)$/i
const PROVIDER_LABELS = new Set(["resend", "inapp", "webhook"])

export function boundedProviderLabel(provider: string): string {
	const candidate = provider.trim().toLowerCase()
	return PROVIDER_LABELS.has(candidate) ? candidate : "other"
}

export function normalizeHttpRoute(path: string): string {
	const normalized = path
		.split("?")[0]!
		.split("/")
		.map((segment) => IDENTIFIER_SEGMENT.test(segment) ? ":id" : segment)
		.join("/")
	return normalized.length <= 160 ? normalized : "/__oversized__"
}

export function observeDatabasePool(stats: {
	total: number
	idle: number
	waiting: number
}): void {
	databasePoolConnections.set({ state: "total" }, stats.total)
	databasePoolConnections.set({ state: "idle" }, stats.idle)
	databasePoolConnections.set({ state: "waiting" }, stats.waiting)
}

export function observeHttp(
	method: string,
	route: string,
	status: number,
	seconds: number,
): void {
	const normalizedMethod = method.toUpperCase().slice(0, 12)
	const normalizedRoute = normalizeHttpRoute(route)
	const statusClass = status >= 100 && status <= 599
		? `${Math.floor(status / 100)}xx`
		: "unknown"
	httpRequests.inc({
		method: normalizedMethod,
		route: normalizedRoute,
		status_class: statusClass,
	})
	httpDuration.observe({ method: normalizedMethod, route: normalizedRoute }, seconds)
}

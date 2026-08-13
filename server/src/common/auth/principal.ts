export const PRINCIPAL_KINDS = [
	"browser_jwt",
	"api_key",
	"subscriber_websocket",
	"provider_webhook",
	"razorpay_webhook",
	"operator_metrics",
] as const

export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number]
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER"
export type CapabilityRole = WorkspaceRole | "API_KEY" | "SUBSCRIBER" | "OPERATOR"
export type VerificationState = "verified" | "unverified" | "not_applicable"

type PrincipalBase = {
	actorId: string | null
	workspaceId: string | null
	scopes: readonly string[]
	verification: VerificationState
}

export type BrowserJwtPrincipal = PrincipalBase & {
	kind: "browser_jwt"
	actorId: string
	workspaceId: string
	sessionId: string
	role: WorkspaceRole
}

export type ApiKeyPrincipal = PrincipalBase & {
	kind: "api_key"
	actorId: string
	workspaceId: string
	keyId: string
}

export type SubscriberWebSocketPrincipal = PrincipalBase & {
	kind: "subscriber_websocket"
	actorId: string
	workspaceId: string
	subscriberId: string
}

export type ProviderWebhookPrincipal = PrincipalBase & {
	kind: "provider_webhook"
	provider: string
}

export type RazorpayWebhookPrincipal = PrincipalBase & {
	kind: "razorpay_webhook"
	provider: "razorpay"
}

export type OperatorMetricsPrincipal = PrincipalBase & {
	kind: "operator_metrics"
	actorId: string
	scopes: readonly ["metrics:read"]
}

export type Principal =
	| BrowserJwtPrincipal
	| ApiKeyPrincipal
	| SubscriberWebSocketPrincipal
	| ProviderWebhookPrincipal
	| RazorpayWebhookPrincipal
	| OperatorMetricsPrincipal

export type WorkspaceContext = {
	actorId: string
	workspaceId: string
	role: CapabilityRole
	scopes: readonly string[]
	verification: VerificationState
	principalKind: PrincipalKind
}

export type AuthorizationCapability = {
	principal: Principal
	workspace: WorkspaceContext | null
}

export function isPrincipal(value: unknown): value is Principal {
	if (!value || typeof value !== "object") return false
	const candidate = value as Record<string, unknown>
	if (
		typeof candidate.kind !== "string" ||
		!PRINCIPAL_KINDS.includes(candidate.kind as PrincipalKind) ||
		(candidate.actorId !== null && typeof candidate.actorId !== "string") ||
		(candidate.workspaceId !== null && typeof candidate.workspaceId !== "string") ||
		!Array.isArray(candidate.scopes) ||
		!candidate.scopes.every((scope) => typeof scope === "string") ||
		!(["verified", "unverified", "not_applicable"] as const).includes(
			candidate.verification as VerificationState,
		)
	) {
		return false
	}

	switch (candidate.kind) {
		case "browser_jwt":
			return (
				typeof candidate.actorId === "string" &&
				typeof candidate.workspaceId === "string" &&
				typeof candidate.sessionId === "string" &&
				["OWNER", "ADMIN", "MEMBER"].includes(candidate.role as string)
			)
		case "api_key":
			return (
				typeof candidate.actorId === "string" &&
				typeof candidate.workspaceId === "string" &&
				typeof candidate.keyId === "string"
			)
		case "subscriber_websocket":
			return (
				typeof candidate.actorId === "string" &&
				typeof candidate.workspaceId === "string" &&
				typeof candidate.subscriberId === "string"
			)
		case "provider_webhook":
			return typeof candidate.provider === "string"
		case "razorpay_webhook":
			return candidate.provider === "razorpay"
		case "operator_metrics":
			return (
				typeof candidate.actorId === "string" &&
				candidate.scopes.length === 1 &&
				candidate.scopes[0] === "metrics:read"
			)
		default:
			return false
	}
}

export function workspaceContextFor(
	principal: BrowserJwtPrincipal | ApiKeyPrincipal,
	role: CapabilityRole,
): WorkspaceContext {
	return {
		actorId: principal.actorId,
		workspaceId: principal.workspaceId,
		role,
		scopes: principal.scopes,
		verification: principal.verification,
		principalKind: principal.kind,
	}
}

export type PrincipalKind =
	| "browser_jwt"
	| "api_key"
	| "subscriber_websocket"
	| "provider_webhook"
	| "razorpay_webhook"
	| "operator_metrics"
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

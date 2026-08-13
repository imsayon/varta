import type { NextFunction, Request, RequestHandler, Response } from "express"
import {
	ForbiddenError,
	EmailNotVerifiedError,
	NotFoundError,
	UnauthorizedError,
} from "@/common/errors/app-error.ts"
import type { CapabilityRole, PrincipalKind } from "./principal.ts"

export type RoutePolicy = {
	id: string
	method: string
	path: string
	public?: boolean
	principalKinds?: readonly PrincipalKind[]
	roles?: readonly CapabilityRole[]
	scopes?: readonly string[]
	hideWorkspaceMismatch?: boolean
}

const browser = ["browser_jwt"] as const
const browserOrKey = ["browser_jwt", "api_key"] as const
const workspaceRoles = ["OWNER", "ADMIN", "MEMBER"] as const
const adminRoles = ["OWNER", "ADMIN"] as const
const triggerRoles = ["OWNER", "ADMIN", "MEMBER", "API_KEY"] as const

export const ROUTE_POLICY_MATRIX: readonly RoutePolicy[] = [
	{ id: "health.read", method: "GET", path: "/api/health", public: true },
	{ id: "health.live", method: "GET", path: "/api/health/live", public: true },
	{ id: "health.startup", method: "GET", path: "/api/health/startup", public: true },
	{ id: "health.ready", method: "GET", path: "/api/health/ready", public: true },
	{ id: "health.combinedReady", method: "GET", path: "/api/health/combined/ready", public: true },
	{ id: "health.workerReady", method: "GET", path: "/api/health/worker/ready", public: true },
	{ id: "metrics.read", method: "GET", path: "/api/metrics", principalKinds: ["operator_metrics"], scopes: ["metrics:read"] },
	{ id: "openapi.read", method: "GET", path: "/api/v1/openapi.json", public: true },

	{ id: "auth.register", method: "POST", path: "/api/v1/auth/register", public: true },
	{ id: "auth.login", method: "POST", path: "/api/v1/auth/login", public: true },
	{ id: "auth.refresh", method: "POST", path: "/api/v1/auth/refresh", public: true },
	{ id: "auth.logout", method: "POST", path: "/api/v1/auth/logout", public: true },
	{ id: "auth.logoutAll", method: "POST", path: "/api/v1/auth/logout-all", public: true },
	{ id: "auth.verifyEmail.get", method: "GET", path: "/api/v1/auth/verify-email", public: true },
	{ id: "auth.verifyEmail.post", method: "POST", path: "/api/v1/auth/verify-email", public: true },
	{ id: "auth.resendVerification", method: "POST", path: "/api/v1/auth/resend-verification", public: true },
	{ id: "auth.forgotPassword", method: "POST", path: "/api/v1/auth/forgot-password", public: true },
	{ id: "auth.resetPassword", method: "POST", path: "/api/v1/auth/reset-password", public: true },
	{ id: "auth.me", method: "GET", path: "/api/v1/auth/me", principalKinds: browser },
	{ id: "auth.sessions.list", method: "GET", path: "/api/v1/auth/sessions", principalKinds: browser },
	{ id: "auth.sessions.revoke", method: "DELETE", path: "/api/v1/auth/sessions/:id", principalKinds: browser },
	{ id: "auth.oauth.google.start", method: "GET", path: "/api/v1/auth/oauth/google", public: true },
	{ id: "auth.oauth.google.callback", method: "GET", path: "/api/v1/auth/oauth/google/callback", public: true },
	{ id: "auth.oauth.github.start", method: "GET", path: "/api/v1/auth/oauth/github", public: true },
	{ id: "auth.oauth.github.callback", method: "GET", path: "/api/v1/auth/oauth/github/callback", public: true },

	{ id: "workspace.create", method: "POST", path: "/api/v1/workspaces", principalKinds: browser },
	{ id: "workspace.list", method: "GET", path: "/api/v1/workspaces", principalKinds: browser },
	{ id: "workspace.read", method: "GET", path: "/api/v1/workspaces/:workspaceId", principalKinds: browser, roles: workspaceRoles },
	{ id: "workspace.update", method: "PATCH", path: "/api/v1/workspaces/:workspaceId", principalKinds: browser, roles: adminRoles, hideWorkspaceMismatch: true },
	{ id: "workspace.delete", method: "DELETE", path: "/api/v1/workspaces/:workspaceId", principalKinds: browser, roles: ["OWNER"], hideWorkspaceMismatch: true },
	{ id: "workspace.members.list", method: "GET", path: "/api/v1/workspaces/:workspaceId/members", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "workspace.wsToken", method: "POST", path: "/api/v1/workspaces/:workspaceId/ws-token", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },

	{ id: "subscriber.create", method: "POST", path: "/api/v1/workspaces/:workspaceId/subscribers", principalKinds: browserOrKey, roles: triggerRoles, scopes: ["subscribers:write"], hideWorkspaceMismatch: true },
	{ id: "subscriber.list", method: "GET", path: "/api/v1/workspaces/:workspaceId/subscribers", principalKinds: browserOrKey, roles: triggerRoles, scopes: ["subscribers:read"], hideWorkspaceMismatch: true },
	{ id: "subscriber.read", method: "GET", path: "/api/v1/workspaces/:workspaceId/subscribers/:subscriberId", principalKinds: browserOrKey, roles: triggerRoles, scopes: ["subscribers:read"], hideWorkspaceMismatch: true },
	{ id: "subscriber.wsToken", method: "POST", path: "/api/v1/workspaces/:workspaceId/subscribers/:subscriberId/ws-token", principalKinds: browserOrKey, roles: triggerRoles, scopes: ["subscribers:ws-token"], hideWorkspaceMismatch: true },
	{ id: "subscriber.update", method: "PATCH", path: "/api/v1/workspaces/:workspaceId/subscribers/:subscriberId", principalKinds: browserOrKey, roles: triggerRoles, scopes: ["subscribers:write"], hideWorkspaceMismatch: true },
	{ id: "subscriber.delete", method: "DELETE", path: "/api/v1/workspaces/:workspaceId/subscribers/:subscriberId", principalKinds: browserOrKey, roles: triggerRoles, scopes: ["subscribers:write"], hideWorkspaceMismatch: true },

	{ id: "template.list", method: "GET", path: "/api/v1/workspaces/:workspaceId/templates", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "template.create", method: "POST", path: "/api/v1/workspaces/:workspaceId/templates", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "template.preview", method: "POST", path: "/api/v1/workspaces/:workspaceId/templates/preview", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "template.read", method: "GET", path: "/api/v1/workspaces/:workspaceId/templates/:templateId", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "template.update", method: "PATCH", path: "/api/v1/workspaces/:workspaceId/templates/:templateId", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "template.delete", method: "DELETE", path: "/api/v1/workspaces/:workspaceId/templates/:templateId", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },

	{ id: "apiKey.list", method: "GET", path: "/api/v1/workspaces/:workspaceId/api-keys", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "apiKey.create", method: "POST", path: "/api/v1/workspaces/:workspaceId/api-keys", principalKinds: browser, roles: adminRoles, hideWorkspaceMismatch: true },
	{ id: "apiKey.revoke", method: "DELETE", path: "/api/v1/workspaces/:workspaceId/api-keys/:keyId", principalKinds: browser, roles: adminRoles, hideWorkspaceMismatch: true },

	{ id: "notification.list", method: "GET", path: "/api/v1/workspaces/:workspaceId/notifications", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "notification.read", method: "GET", path: "/api/v1/workspaces/:workspaceId/notifications/:notificationId", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "notification.markRead", method: "PATCH", path: "/api/v1/workspaces/:workspaceId/notifications/:notificationId/read", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "notification.trigger", method: "POST", path: "/api/v1/workspaces/:workspaceId/notifications/trigger", principalKinds: browserOrKey, roles: triggerRoles, scopes: ["notifications:trigger"], hideWorkspaceMismatch: true },
	{ id: "notification.retry", method: "POST", path: "/api/v1/workspaces/:workspaceId/notifications/:notificationId/retry", principalKinds: browserOrKey, roles: triggerRoles, scopes: ["notifications:retry"], hideWorkspaceMismatch: true },

	{ id: "routing.compile", method: "POST", path: "/api/v1/workspaces/:workspaceId/routing-rules/compile", principalKinds: browser, roles: adminRoles, hideWorkspaceMismatch: true },
	{ id: "routing.list", method: "GET", path: "/api/v1/workspaces/:workspaceId/routing-rules", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "routing.create", method: "POST", path: "/api/v1/workspaces/:workspaceId/routing-rules", principalKinds: browser, roles: adminRoles, hideWorkspaceMismatch: true },
	{ id: "routing.update", method: "PATCH", path: "/api/v1/workspaces/:workspaceId/routing-rules/:ruleId", principalKinds: browser, roles: adminRoles, hideWorkspaceMismatch: true },
	{ id: "routing.delete", method: "DELETE", path: "/api/v1/workspaces/:workspaceId/routing-rules/:ruleId", principalKinds: browser, roles: adminRoles, hideWorkspaceMismatch: true },

	{ id: "analytics.overview", method: "GET", path: "/api/v1/workspaces/:workspaceId/analytics/overview", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "analytics.deliveryTimeline", method: "GET", path: "/api/v1/workspaces/:workspaceId/analytics/delivery-timeline", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "analytics.channelBreakdown", method: "GET", path: "/api/v1/workspaces/:workspaceId/analytics/channel-breakdown", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },
	{ id: "analytics.topTemplates", method: "GET", path: "/api/v1/workspaces/:workspaceId/analytics/top-templates", principalKinds: browser, roles: workspaceRoles, hideWorkspaceMismatch: true },

	{ id: "provider.list", method: "GET", path: "/api/v1/workspaces/:workspaceId/providers", principalKinds: browser, roles: adminRoles, hideWorkspaceMismatch: true },
	{ id: "provider.upsert", method: "PUT", path: "/api/v1/workspaces/:workspaceId/providers/:channel", principalKinds: browser, roles: adminRoles, hideWorkspaceMismatch: true },
	{ id: "provider.test", method: "POST", path: "/api/v1/workspaces/:workspaceId/providers/:channel/test", principalKinds: browser, roles: adminRoles, hideWorkspaceMismatch: true },

	{ id: "billing.read", method: "GET", path: "/api/v1/workspaces/:workspaceId/billing", principalKinds: browser, roles: ["OWNER"], hideWorkspaceMismatch: true },
	{ id: "billing.checkout", method: "POST", path: "/api/v1/workspaces/:workspaceId/billing/checkout", principalKinds: browser, roles: ["OWNER"], hideWorkspaceMismatch: true },
	{ id: "billing.checkout.verify", method: "POST", path: "/api/v1/workspaces/:workspaceId/billing/checkout/verify", principalKinds: browser, roles: ["OWNER"], hideWorkspaceMismatch: true },
	{ id: "billing.cancel", method: "POST", path: "/api/v1/workspaces/:workspaceId/billing/cancel", principalKinds: browser, roles: ["OWNER"], hideWorkspaceMismatch: true },
	{ id: "billing.reconcile", method: "POST", path: "/api/v1/workspaces/:workspaceId/billing/reconcile", principalKinds: browser, roles: ["OWNER"], hideWorkspaceMismatch: true },

	{ id: "webhook.provider.resend", method: "POST", path: "/api/v1/webhooks/resend", public: true },
	{ id: "webhook.provider.razorpay", method: "POST", path: "/api/v1/webhooks/razorpay", public: true },
	{ id: "websocket.subscriber", method: "GET", path: "/ws", principalKinds: ["subscriber_websocket"] },
	{ id: "websocket.workspace", method: "GET", path: "/ws", principalKinds: browser },
] as const

export const MOUNTED_ROUTE_POLICY_IDS = ROUTE_POLICY_MATRIX.map((policy) => policy.id)

const policyById = new Map(ROUTE_POLICY_MATRIX.map((policy) => [policy.id, policy]))

export function getRoutePolicy(id: string): RoutePolicy {
	const policy = policyById.get(id)
	if (!policy) throw new Error(`Missing route authorization policy: ${id}`)
	return policy
}

export function authorize(policyId: string): RequestHandler {
	const policy = getRoutePolicy(policyId)
	return (req: Request, _res: Response, next: NextFunction): void => {
		if (policy.public) {
			next()
			return
		}

		const capability = req.capability
		if (!capability) {
			next(new UnauthorizedError("Authentication required"))
			return
		}
		if (!policy.principalKinds?.includes(capability.principal.kind)) {
			next(new ForbiddenError("Principal is not allowed for this route"))
			return
		}
		if (
			capability.principal.kind === "browser_jwt" &&
			!policy.id.startsWith("auth.") &&
			capability.principal.verification !== "verified"
		) {
			next(new EmailNotVerifiedError())
			return
		}

		const workspaceId = req.params.workspaceId
		if (workspaceId && capability.workspace?.workspaceId !== workspaceId) {
			next(
				policy.hideWorkspaceMismatch
					? new NotFoundError("Resource not found")
					: new ForbiddenError("Workspace access denied"),
			)
			return
		}

		if (policy.roles && !policy.roles.includes(capability.workspace?.role as CapabilityRole)) {
			next(new ForbiddenError("Insufficient role for this route"))
			return
		}

		if (policy.scopes && capability.principal.kind === "api_key") {
			const scopes = capability.workspace?.scopes ?? capability.principal.scopes
			if (
				!scopes.includes("*") &&
				!policy.scopes.every((scope) => scopes.includes(scope))
			) {
				next(new ForbiddenError("Insufficient scope for this route"))
				return
			}
		}

		next()
	}
}

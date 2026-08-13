/**
 * Phase F1 — Subscription state machine, entitlement evaluation, and notification unit accounting.
 */

import { BILLING_CATALOG, type BillingPlanId, type PlanLimits } from "./billing.constants.ts"

export type SubscriptionStatus =
	| "PENDING"
	| "ACTIVE"
	| "GRACE"
	| "PAUSED"
	| "CANCELLED"
	| "EXPIRED"

/**
 * Valid monotonic subscription state transitions.
 */
const VALID_SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, ReadonlySet<SubscriptionStatus>> = {
	PENDING: new Set(["ACTIVE", "CANCELLED", "EXPIRED"]),
	ACTIVE: new Set(["GRACE", "PAUSED", "CANCELLED", "EXPIRED"]),
	GRACE: new Set(["ACTIVE", "CANCELLED", "EXPIRED"]),
	PAUSED: new Set(["ACTIVE", "CANCELLED", "EXPIRED"]),
	CANCELLED: new Set(["ACTIVE"]), // Re-subscription
	EXPIRED: new Set(["ACTIVE", "PENDING"]),
}

export function canTransitionSubscription(
	from: SubscriptionStatus,
	to: SubscriptionStatus,
): boolean {
	if (from === to) return true
	return VALID_SUBSCRIPTION_TRANSITIONS[from]?.has(to) ?? false
}

export interface AccountEntitlement {
	planId: BillingPlanId
	status: SubscriptionStatus
	limits: PlanLimits
	isGracePeriodActive: boolean
	graceExpiresAt?: Date | undefined
	canAccessAi: boolean
	canAcceptNotifications: boolean
}

export function notificationQuotaLimit(planId: BillingPlanId): number {
	const plan = BILLING_CATALOG[planId]
	return Math.floor(
		plan.limits.maxNotificationRunsPerMonth *
			(1 + plan.paidUsageGracePercent / 100),
	)
}

/**
 * Derives current effective account entitlements based on plan and subscription status.
 */
export function deriveEntitlements(
	planId: BillingPlanId,
	status: SubscriptionStatus,
	graceExpiresAt?: Date | undefined,
): AccountEntitlement {
	const plan = BILLING_CATALOG[planId] ?? BILLING_CATALOG.free
	const now = new Date()

	const isGracePeriodActive =
		status === "GRACE" &&
		graceExpiresAt !== undefined &&
		graceExpiresAt.getTime() > now.getTime()

	const isEntitled =
		status === "ACTIVE" ||
		isGracePeriodActive ||
		(planId === "free" && status !== "EXPIRED")

	return {
		planId: plan.id,
		status,
		limits: plan.limits,
		isGracePeriodActive,
		graceExpiresAt,
		canAccessAi: isEntitled && plan.limits.aiFeaturesEnabled,
		canAcceptNotifications: isEntitled,
	}
}

/**
 * Billing Unit Rule:
 * One notification run is defined as ONE durably accepted trigger per resolved subscriber,
 * regardless of how many channels (EMAIL, IN_APP, WEBHOOK) are fanned out for that subscriber.
 */
export function calculateNotificationRunUnits(resolvedSubscriberCount: number): number {
	if (resolvedSubscriberCount <= 0) return 0
	return Math.ceil(resolvedSubscriberCount)
}

/**
 * Checks whether current usage exceeds plan limits or warning thresholds.
 */
export function evaluateQuotaUsage(
	currentUsage: number,
	maxLimit: number,
): {
	percentage: number
	isExceeded: boolean
	warningLevel: "none" | "70" | "85" | "100"
} {
	if (maxLimit <= 0) {
		return { percentage: 100, isExceeded: true, warningLevel: "100" }
	}

	const percentage = (currentUsage / maxLimit) * 100
	const isExceeded = currentUsage > maxLimit

	let warningLevel: "none" | "70" | "85" | "100" = "none"
	if (percentage >= 100) {
		warningLevel = "100"
	} else if (percentage >= 85) {
		warningLevel = "85"
	} else if (percentage >= 70) {
		warningLevel = "70"
	}

	return {
		percentage: Math.min(percentage, 100),
		isExceeded,
		warningLevel,
	}
}

/**
 * Phase F1 — Razorpay billing catalog, billing units, ownership, and entitlement constants.
 */

export const BILLING_PLANS = {
	FREE: "free",
	PLUS: "plus",
	BUSINESS: "business",
} as const

export type BillingPlanId = (typeof BILLING_PLANS)[keyof typeof BILLING_PLANS]

export interface PlanLimits {
	maxWorkspaces: number
	maxMembers: number
	maxSubscribers: number
	maxNotificationRunsPerMonth: number
	maxRps: number
	aiFeaturesEnabled: boolean
	maxAiRequestsPerMonth: number
}

export interface PlanPrice {
	inrMonthly: number // Price in INR (₹)
	usdMonthly: number // Price in USD ($)
}

export interface PlanDefinition {
	id: BillingPlanId
	name: string
	description: string
	version: string
	price: PlanPrice
	limits: PlanLimits
	paidUsageGracePercent: number
}

export const BILLING_CATALOG_VERSION = "2026-08-10"

export const BILLING_CATALOG: Record<BillingPlanId, PlanDefinition> = {
	[BILLING_PLANS.FREE]: {
		id: BILLING_PLANS.FREE,
		name: "Free Tier",
		description: "For testing, prototyping, and small projects",
		version: BILLING_CATALOG_VERSION,
		price: {
			inrMonthly: 0,
			usdMonthly: 0,
		},
		limits: {
			maxWorkspaces: 3,
			maxMembers: 5,
			maxSubscribers: 5_000,
			maxNotificationRunsPerMonth: 20_000,
			maxRps: 10,
			aiFeaturesEnabled: true,
			maxAiRequestsPerMonth: 50,
		},
		paidUsageGracePercent: 0,
	},
	[BILLING_PLANS.PLUS]: {
		id: BILLING_PLANS.PLUS,
		name: "Plus Tier",
		description: "For growing apps needing AI routing and higher throughput",
		version: BILLING_CATALOG_VERSION,
		price: {
			inrMonthly: 699,
			usdMonthly: 9,
		},
		limits: {
			maxWorkspaces: 5,
			maxMembers: 15,
			maxSubscribers: 50_000,
			maxNotificationRunsPerMonth: 200_000,
			maxRps: 60,
			aiFeaturesEnabled: true,
			maxAiRequestsPerMonth: 1_000,
		},
		paidUsageGracePercent: 10,
	},
	[BILLING_PLANS.BUSINESS]: {
		id: BILLING_PLANS.BUSINESS,
		name: "Business Tier",
		description: "For high-volume production applications with dedicated support",
		version: BILLING_CATALOG_VERSION,
		price: {
			inrMonthly: 4_499,
			usdMonthly: 55,
		},
		limits: {
			maxWorkspaces: 15,
			maxMembers: 30,
			maxSubscribers: 500_000,
			maxNotificationRunsPerMonth: 1_000_000,
			maxRps: 200,
			aiFeaturesEnabled: true,
			maxAiRequestsPerMonth: 5_000,
		},
		paidUsageGracePercent: 10,
	},
} as const

/**
 * Grace period configuration.
 * When payment fails, the subscription enters GRACE state for 7 days before EXPIRING.
 */
export const BILLING_GRACE_PERIOD_DAYS = 7
export const BILLING_GRACE_PERIOD_MS = BILLING_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000

/**
 * Usage warning thresholds (70%, 85%, 100%).
 */
export const USAGE_WARNING_THRESHOLDS = [0.70, 0.85, 1.00] as const

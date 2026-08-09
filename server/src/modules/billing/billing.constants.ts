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
	maxMembersPerWorkspace: number
	maxSubscribersPerWorkspace: number
	maxNotificationRunsPerMonth: number
	maxRps: number
	aiFeaturesEnabled: boolean
	maxAiRequestsPerMinute: number
}

export interface PlanPrice {
	inrMonthly: number // Price in INR (₹)
	usdMonthly: number // Price in USD ($)
}

export interface PlanDefinition {
	id: BillingPlanId
	name: string
	description: string
	price: PlanPrice
	limits: PlanLimits
	razorpayPlanIdInr?: string
	razorpayPlanIdUsd?: string
}

export const BILLING_CATALOG: Record<BillingPlanId, PlanDefinition> = {
	[BILLING_PLANS.FREE]: {
		id: BILLING_PLANS.FREE,
		name: "Free Tier",
		description: "For testing, prototyping, and small projects",
		price: {
			inrMonthly: 0,
			usdMonthly: 0,
		},
		limits: {
			maxWorkspaces: 1,
			maxMembersPerWorkspace: 3,
			maxSubscribersPerWorkspace: 1_000,
			maxNotificationRunsPerMonth: 10_000,
			maxRps: 5,
			aiFeaturesEnabled: false,
			maxAiRequestsPerMinute: 0,
		},
	},
	[BILLING_PLANS.PLUS]: {
		id: BILLING_PLANS.PLUS,
		name: "Plus Tier",
		description: "For growing apps needing AI routing and higher throughput",
		price: {
			inrMonthly: 1_499, // ₹1,499 / month
			usdMonthly: 19,    // $19 / month
		},
		limits: {
			maxWorkspaces: 3,
			maxMembersPerWorkspace: 10,
			maxSubscribersPerWorkspace: 25_000,
			maxNotificationRunsPerMonth: 250_000,
			maxRps: 25,
			aiFeaturesEnabled: true,
			maxAiRequestsPerMinute: 30,
		},
	},
	[BILLING_PLANS.BUSINESS]: {
		id: BILLING_PLANS.BUSINESS,
		name: "Business Tier",
		description: "For high-volume production applications with dedicated support",
		price: {
			inrMonthly: 7_999, // ₹7,999 / month
			usdMonthly: 99,    // $99 / month
		},
		limits: {
			maxWorkspaces: 10,
			maxMembersPerWorkspace: 50,
			maxSubscribersPerWorkspace: 250_000,
			maxNotificationRunsPerMonth: 2_500_000,
			maxRps: 100,
			aiFeaturesEnabled: true,
			maxAiRequestsPerMinute: 120,
		},
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

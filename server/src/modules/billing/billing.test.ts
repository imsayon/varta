import assert from "node:assert/strict"
import test from "node:test"
import {
	BILLING_CATALOG,
	BILLING_PLANS,
	BILLING_GRACE_PERIOD_DAYS,
	USAGE_WARNING_THRESHOLDS,
} from "./billing.constants.ts"
import {
	canTransitionSubscription,
	deriveEntitlements,
	calculateNotificationRunUnits,
	evaluateQuotaUsage,
	type SubscriptionStatus,
} from "./billing-state.ts"

// --- Phase F1 Catalog & Plan Integrity ---

test("F1 Catalog: contains all defined plan IDs with positive limits and valid pricing", () => {
	const planIds = Object.values(BILLING_PLANS)
	assert.equal(planIds.length, 3, "Catalog defines Free, Plus, Business")

	for (const id of planIds) {
		const plan = BILLING_CATALOG[id]
		assert.ok(plan, `Plan ${id} must exist in catalog`)
		assert.equal(plan.id, id)
		assert.ok(plan.name.length > 0)
		assert.ok(plan.limits.maxWorkspaces >= 1)
		assert.ok(plan.limits.maxMembers >= 1)
		assert.ok(plan.limits.maxSubscribers >= 100)
		assert.ok(plan.limits.maxNotificationRunsPerMonth >= 1_000)
		assert.ok(plan.limits.maxRps >= 1)
	}

	// Free plan is ₹0 / $0
	assert.equal(BILLING_CATALOG.free.price.inrMonthly, 0)
	assert.equal(BILLING_CATALOG.free.price.usdMonthly, 0)

	// Plus plan pricing
	assert.equal(BILLING_CATALOG.plus.price.inrMonthly, 699)
	assert.equal(BILLING_CATALOG.plus.price.usdMonthly, 9)

	// Business plan pricing
	assert.equal(BILLING_CATALOG.business.price.inrMonthly, 4499)
	assert.equal(BILLING_CATALOG.business.price.usdMonthly, 55)
})

test("F1 Catalog: AI limits match plan features", () => {
	assert.equal(BILLING_CATALOG.free.limits.aiFeaturesEnabled, true)
	assert.equal(BILLING_CATALOG.free.limits.maxAiRequestsPerMonth, 50)

	assert.equal(BILLING_CATALOG.plus.limits.aiFeaturesEnabled, true)
	assert.equal(BILLING_CATALOG.plus.limits.maxAiRequestsPerMonth, 1_000)

	assert.equal(BILLING_CATALOG.business.limits.aiFeaturesEnabled, true)
	assert.ok(
		BILLING_CATALOG.business.limits.maxAiRequestsPerMonth >
			BILLING_CATALOG.plus.limits.maxAiRequestsPerMonth,
	)
})

// --- Phase F1 Subscription State Machine ---

test("F1 State Machine: valid subscription transitions", () => {
	// PENDING → ACTIVE, CANCELLED, EXPIRED
	assert.equal(canTransitionSubscription("PENDING", "ACTIVE"), true)
	assert.equal(canTransitionSubscription("PENDING", "CANCELLED"), true)
	assert.equal(canTransitionSubscription("PENDING", "EXPIRED"), true)

	// ACTIVE → GRACE, PAUSED, CANCELLED, EXPIRED
	assert.equal(canTransitionSubscription("ACTIVE", "GRACE"), true)
	assert.equal(canTransitionSubscription("ACTIVE", "PAUSED"), true)
	assert.equal(canTransitionSubscription("ACTIVE", "CANCELLED"), true)
	assert.equal(canTransitionSubscription("ACTIVE", "EXPIRED"), true)

	// GRACE → ACTIVE (payment recovered), EXPIRED (grace lapsed), CANCELLED
	assert.equal(canTransitionSubscription("GRACE", "ACTIVE"), true)
	assert.equal(canTransitionSubscription("GRACE", "EXPIRED"), true)
	assert.equal(canTransitionSubscription("GRACE", "CANCELLED"), true)

	// Same state self-transition is always valid
	const statuses: SubscriptionStatus[] = ["PENDING", "ACTIVE", "GRACE", "PAUSED", "CANCELLED", "EXPIRED"]
	for (const s of statuses) {
		assert.equal(canTransitionSubscription(s, s), true)
	}
})

test("F1 State Machine: invalid subscription transitions fail closed", () => {
	// PENDING cannot transition to GRACE or PAUSED without being ACTIVE first
	assert.equal(canTransitionSubscription("PENDING", "GRACE"), false)
	assert.equal(canTransitionSubscription("PENDING", "PAUSED"), false)

	// EXPIRED cannot transition directly to GRACE or PAUSED
	assert.equal(canTransitionSubscription("EXPIRED", "GRACE"), false)
	assert.equal(canTransitionSubscription("EXPIRED", "PAUSED"), false)
})

// --- Phase F1 Entitlement Derivation ---

test("F1 Entitlement: ACTIVE subscription gets full limits and AI access", () => {
	const ent = deriveEntitlements("plus", "ACTIVE")
	assert.equal(ent.canAcceptNotifications, true)
	assert.equal(ent.canAccessAi, true)
	assert.equal(ent.isGracePeriodActive, false)
	assert.equal(ent.limits.maxNotificationRunsPerMonth, 200_000)
})

test("F1 Entitlement: GRACE period keeps access active while unexpired", () => {
	const futureGrace = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days in future
	const ent = deriveEntitlements("plus", "GRACE", futureGrace)
	assert.equal(ent.isGracePeriodActive, true)
	assert.equal(ent.canAcceptNotifications, true)
	assert.equal(ent.canAccessAi, true)
})

test("F1 Entitlement: EXPIRED grace period revokes notification and AI access for paid plans", () => {
	const pastGrace = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day in past
	const ent = deriveEntitlements("plus", "GRACE", pastGrace)
	assert.equal(ent.isGracePeriodActive, false)
	assert.equal(ent.canAcceptNotifications, false)
	assert.equal(ent.canAccessAi, false)
})

// --- Phase F1 Billing Unit Accounting ---

test("F1 Billing Unit: 1 notification run = 1 trigger per resolved subscriber regardless of channels", () => {
	// 1 subscriber resolved → 1 unit
	assert.equal(calculateNotificationRunUnits(1), 1)

	// 50 subscribers resolved → 50 units (even if delivered across Email + In-App + Webhook)
	assert.equal(calculateNotificationRunUnits(50), 50)

	// 0 subscribers resolved → 0 units
	assert.equal(calculateNotificationRunUnits(0), 0)
	assert.equal(calculateNotificationRunUnits(-5), 0)
})

// --- Phase F1 Quota Usage Evaluation & Warning Levels ---

test("F1 Quota: evaluates 70%, 85%, 100% warning levels accurately", () => {
	const limit = 20_000

	// Below 70% → none
	const q50 = evaluateQuotaUsage(10_000, limit)
	assert.equal(q50.percentage, 50)
	assert.equal(q50.isExceeded, false)
	assert.equal(q50.warningLevel, "none")

	// At 70% → 70 warning
	const q70 = evaluateQuotaUsage(14_000, limit)
	assert.equal(q70.percentage, 70)
	assert.equal(q70.isExceeded, false)
	assert.equal(q70.warningLevel, "70")

	// At 85% → 85 warning
	const q85 = evaluateQuotaUsage(17_000, limit)
	assert.equal(q85.percentage, 85)
	assert.equal(q85.isExceeded, false)
	assert.equal(q85.warningLevel, "85")

	// At 100% → 100 warning and exceeded
	const q100 = evaluateQuotaUsage(20_000, limit)
	assert.equal(q100.percentage, 100)
	assert.equal(q100.isExceeded, false)
	assert.equal(q100.warningLevel, "100")

	// Above limit → capped percentage 100, exceeded, 100 warning
	const q120 = evaluateQuotaUsage(24_000, limit)
	assert.equal(q120.percentage, 100)
	assert.equal(q120.isExceeded, true)
	assert.equal(q120.warningLevel, "100")
})

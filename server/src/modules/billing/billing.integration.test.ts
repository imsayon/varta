import assert from "node:assert/strict"
import test from "node:test"
import crypto from "node:crypto"
import { createRazorpayClient, razorpayClient } from "./razorpay.client.ts"
import { billingService } from "./billing.service.ts"
import { BILLING_CATALOG } from "./billing.constants.ts"
import { deriveEntitlements, canTransitionSubscription } from "./billing-state.ts"
import { prisma, disconnectDatabase } from "@/infra/database/prisma.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"
import { encrypt } from "@/common/utils/crypto.util.ts"
import { workspaceRepository } from "@/modules/workspaces/workspace.repository.ts"

const runDatabaseTests = process.env.RUN_BILLING_DATABASE_TESTS === "true"
test.after(async () => {
	if (runDatabaseTests) await disconnectDatabase()
})

// --- Phase F3/F4 Razorpay Client & Webhook Signature Unit Tests ---

test("Razorpay Client: HMAC webhook signature verification", () => {
	const rawPayload = JSON.stringify({ event: "subscription.charged", entity: { id: "sub_123" } })
	const secret = "test-webhook-secret-not-a-secret"

	const validSignature = crypto
		.createHmac("sha256", secret)
		.update(rawPayload)
		.digest("hex")

	// Valid signature passes
	assert.equal(razorpayClient.verifyWebhookSignature(rawPayload, validSignature, secret), true)

	// Tampered payload fails
	assert.equal(razorpayClient.verifyWebhookSignature(rawPayload + "tampered", validSignature, secret), false)

	// Invalid signature fails
	assert.equal(razorpayClient.verifyWebhookSignature(rawPayload, "invalid_sig", secret), false)

	// Missing inputs fail
	assert.equal(razorpayClient.verifyWebhookSignature("", validSignature, secret), false)
})

test("Razorpay Client: runtime fails closed instead of returning demo identifiers", async () => {
	const disabledClient = createRazorpayClient(fetch, {
		mode: "disabled",
		keyId: "",
		keySecret: "",
		requestTimeoutMs: 500,
	})
	await assert.rejects(
		() => disabledClient.createCustomer({ name: "No Demo", email: "owner@example.test" }),
		/Razorpay billing is disabled/,
	)
})

// --- Phase F5/F6 Subscription State Machine & Quota Reservation Tests ---

test("Billing Entitlement: Free plan active status uses the frozen catalog", () => {
	const ent = deriveEntitlements("free", "ACTIVE")
	assert.equal(ent.canAcceptNotifications, true)
	assert.equal(ent.canAccessAi, true)
	assert.equal(ent.limits.maxNotificationRunsPerMonth, 20_000)
	assert.equal(ent.limits.maxRps, 10)
})

test("Billing Entitlement: Plus plan active status enables AI and 200,000 runs", () => {
	const ent = deriveEntitlements("plus", "ACTIVE")
	assert.equal(ent.canAcceptNotifications, true)
	assert.equal(ent.canAccessAi, true)
	assert.equal(ent.limits.maxNotificationRunsPerMonth, 200_000)
	assert.equal(ent.limits.maxRps, 60)
})

test("Billing State Machine: Monotonic transitions safeguard state changes", () => {
	// Legal transitions
	assert.equal(canTransitionSubscription("PENDING", "ACTIVE"), true)
	assert.equal(canTransitionSubscription("ACTIVE", "GRACE"), true)
	assert.equal(canTransitionSubscription("GRACE", "ACTIVE"), true) // Recovery
	assert.equal(canTransitionSubscription("GRACE", "EXPIRED"), true) // Grace lapse
	assert.equal(canTransitionSubscription("ACTIVE", "CANCELLED"), true)

	// Illegal transitions fail closed
	assert.equal(canTransitionSubscription("PENDING", "GRACE"), false)
	assert.equal(canTransitionSubscription("EXPIRED", "GRACE"), false)
	assert.equal(canTransitionSubscription("CANCELLED", "GRACE"), false)
})

test("Billing database: concurrent reservations cannot overspend or double charge", { skip: !runDatabaseTests }, async () => {
	const fixture = await createOwnedTestWorkspace("Billing quota")
	try {
		const link = await prisma.billingAccountWorkspace.findUniqueOrThrow({ where: { workspaceId: fixture.workspace.id } })
		const now = new Date()
		const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
		const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
		await prisma.usageLedger.create({
			data: {
				billingAccountId: link.billingAccountId,
				workspaceId: fixture.workspace.id,
				operationId: `fixture:${crypto.randomUUID()}`,
				kind: "NOTIFICATION_RESERVATION",
				deltaUnits: 19_999,
				balanceAfter: 19_999,
				periodStart,
				periodEnd,
			},
		})
		const operationIds = Array.from({ length: 8 }, () => crypto.randomUUID())
		const attempts = await Promise.allSettled(
			operationIds.map((operationId) => billingService.reserveQuota(fixture.workspace.id, operationId)),
		)
		assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1)
		assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 7)
		const usage = await prisma.usageLedger.aggregate({
			where: { billingAccountId: link.billingAccountId, periodStart },
			_sum: { deltaUnits: true },
		})
		assert.equal(usage._sum.deltaUnits, 20_000)
		const savedReservation = await prisma.usageLedger.findFirst({
			where: {
				operationId: { in: operationIds.map((operationId) => `notification:${fixture.workspace.id}:${operationId}`) },
			},
		})
		assert.ok(savedReservation)
		const successfulOperation = savedReservation.operationId.slice(`notification:${fixture.workspace.id}:`.length)
		const duplicateBalance = await billingService.reserveQuota(fixture.workspace.id, successfulOperation)
		assert.equal(duplicateBalance, 20_000)
		assert.equal(await prisma.usageLedger.count({ where: { billingAccountId: link.billingAccountId } }), 2)
	} finally {
		await fixture.cleanup()
	}
})

test("Billing database: AI reservations are account-scoped, atomic, and idempotent", { skip: !runDatabaseTests }, async () => {
	const fixture = await createOwnedTestWorkspace("Billing AI quota")
	try {
		const link = await prisma.billingAccountWorkspace.findUniqueOrThrow({ where: { workspaceId: fixture.workspace.id } })
		const now = new Date()
		const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
		const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
		await prisma.usageLedger.create({
			data: {
				billingAccountId: link.billingAccountId,
				workspaceId: fixture.workspace.id,
				operationId: `ai-fixture:${crypto.randomUUID()}`,
				kind: "AI_RESERVATION",
				deltaUnits: 49,
				balanceAfter: 49,
				periodStart,
				periodEnd,
			},
		})
		const operationIds = Array.from({ length: 8 }, () => crypto.randomUUID())
		const attempts = await Promise.allSettled(
			operationIds.map((operationId) => billingService.reserveAiQuota(fixture.workspace.id, operationId)),
		)
		assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1)
		assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 7)
		const savedReservation = await prisma.usageLedger.findFirstOrThrow({
			where: {
				operationId: { in: operationIds.map((operationId) => `ai:${fixture.workspace.id}:${operationId}`) },
			},
		})
		const successfulOperation = savedReservation.operationId.slice(`ai:${fixture.workspace.id}:`.length)
		assert.equal(await billingService.reserveAiQuota(fixture.workspace.id, successfulOperation), 50)
		const usage = await prisma.usageLedger.aggregate({
			where: { billingAccountId: link.billingAccountId, kind: "AI_RESERVATION", periodStart },
			_sum: { deltaUnits: true },
		})
		assert.equal(usage._sum.deltaUnits, 50)
		assert.equal(await prisma.usageLedger.count({
			where: { billingAccountId: link.billingAccountId, kind: "AI_RESERVATION" },
		}), 2)
	} finally {
		await fixture.cleanup()
	}
})

test("Billing database: account-wide member limits reject concurrent growth", { skip: !runDatabaseTests }, async () => {
	const fixture = await createOwnedTestWorkspace("Billing members")
	const users = await Promise.all(Array.from({ length: 8 }, () => prisma.user.create({
		data: { email: `${crypto.randomUUID()}@member-limit.example.test`, emailVerified: true },
	})))
	try {
		const attempts = await Promise.allSettled(
			users.map((user) => workspaceRepository.addMember(fixture.workspace.id, user.id, "MEMBER")),
		)
		assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 4)
		assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 4)
		assert.equal(await prisma.workspaceMember.count({ where: { workspaceId: fixture.workspace.id } }), 5)
	} finally {
		await fixture.cleanup()
		await prisma.user.deleteMany({ where: { id: { in: users.map(({ id }) => id) } } })
	}
})

test("Billing database: webhook projection is monotonic, auditable, and ignores stale events", { skip: !runDatabaseTests }, async () => {
	const fixture = await createOwnedTestWorkspace("Billing webhook")
	try {
		const link = await prisma.billingAccountWorkspace.findUniqueOrThrow({ where: { workspaceId: fixture.workspace.id } })
		const subscription = await prisma.subscription.create({
			data: {
				billingAccountId: link.billingAccountId,
				planId: "plus",
				planVersion: "2026-08-10",
				status: "PENDING",
				razorpaySubscriptionId: `sub_${crypto.randomUUID()}`,
			},
		})
		const activePayload = JSON.stringify({
			event: "subscription.activated",
			created_at: 2_000,
			payload: { subscription: { entity: {
				id: subscription.razorpaySubscriptionId,
				status: "active",
				current_start: null,
				current_end: null,
				ended_at: null,
			} } },
		})
		const activeEvent = await prisma.billingWebhookEvent.create({
			data: {
				eventId: `evt_${crypto.randomUUID()}`,
				eventType: "subscription.activated",
				payloadCiphertext: encrypt(activePayload),
				payloadHash: crypto.createHash("sha256").update(activePayload).digest("hex"),
				signatureHash: "fixture",
			},
		})
		await billingService.processWebhookEvent(activeEvent.id)
		const activated = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })
		assert.equal(activated.status, "ACTIVE")
		assert.equal(activated.currentPeriodStart, null)
		assert.equal(activated.currentPeriodEnd, null)
		assert.equal(await prisma.entitlementSnapshot.count({ where: { billingAccountId: link.billingAccountId } }), 1)
		assert.equal(await prisma.billingAuditEvent.count({ where: { billingAccountId: link.billingAccountId } }), 1)

		const stalePayload = JSON.stringify({
			event: "subscription.cancelled",
			created_at: 1_000,
			payload: { subscription: { entity: { id: subscription.razorpaySubscriptionId, status: "cancelled" } } },
		})
		const staleEvent = await prisma.billingWebhookEvent.create({
			data: {
				eventId: `evt_${crypto.randomUUID()}`,
				eventType: "subscription.cancelled",
				payloadCiphertext: encrypt(stalePayload),
				payloadHash: crypto.createHash("sha256").update(stalePayload).digest("hex"),
				signatureHash: "fixture",
			},
		})
		await billingService.processWebhookEvent(staleEvent.id)
		assert.equal((await prisma.billingWebhookEvent.findUniqueOrThrow({ where: { id: staleEvent.id } })).status, "IGNORED")
		assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).status, "ACTIVE")
	} finally {
		await fixture.cleanup()
	}
})

test("Billing database: verified lifecycle events project every supported state and retain refunds", { skip: !runDatabaseTests }, async () => {
	const fixture = await createOwnedTestWorkspace("Billing lifecycle")
	try {
		const link = await prisma.billingAccountWorkspace.findUniqueOrThrow({ where: { workspaceId: fixture.workspace.id } })
		const providerSubscriptionId = `sub_${crypto.randomUUID()}`
		const subscription = await prisma.subscription.create({
			data: {
				billingAccountId: link.billingAccountId,
				planId: "plus",
				planVersion: "2026-08-10",
				status: "PENDING",
				razorpaySubscriptionId: providerSubscriptionId,
			},
		})
		const project = async (eventType: string, createdAt: number) => {
			const raw = JSON.stringify({
				event: eventType,
				created_at: createdAt,
				payload: { subscription: { entity: { id: providerSubscriptionId, status: eventType.split(".").at(-1) } } },
			})
			const event = await prisma.billingWebhookEvent.create({
				data: {
					eventId: `evt_${crypto.randomUUID()}`,
					eventType,
					payloadCiphertext: encrypt(raw),
					payloadHash: crypto.createHash("sha256").update(raw).digest("hex"),
					signatureHash: "fixture",
				},
			})
			await billingService.processWebhookEvent(event.id)
			return prisma.billingWebhookEvent.findUniqueOrThrow({ where: { id: event.id } })
		}

		const transitions: Array<[string, string]> = [
			["subscription.activated", "ACTIVE"],
			["payment.failed", "GRACE"],
			["subscription.resumed", "ACTIVE"],
			["subscription.paused", "PAUSED"],
			["subscription.resumed", "ACTIVE"],
			["subscription.cancelled", "CANCELLED"],
			["subscription.activated", "ACTIVE"],
			["subscription.expired", "EXPIRED"],
		]
		for (const [index, [eventType, expected]] of transitions.entries()) {
			assert.equal((await project(eventType, 2_000 + index)).status, "PROCESSED")
			assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).status, expected)
		}
		const refund = await project("refund.processed", 3_000)
		assert.equal(refund.status, "IGNORED")
		assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).status, "EXPIRED")
		assert.equal(await prisma.billingAuditEvent.count({
			where: { billingAccountId: link.billingAccountId, action: "subscription.transition" },
		}), transitions.length)
	} finally {
		await fixture.cleanup()
	}
})

test("Billing database: expired worker leases recover and poison events fail safely", { skip: !runDatabaseTests }, async () => {
	const validUnknown = JSON.stringify({ event: "provider.unknown", payload: {} })
	const expiredLease = await prisma.billingWebhookEvent.create({
		data: {
			eventId: `evt_${crypto.randomUUID()}`,
			eventType: "provider.unknown",
			payloadCiphertext: encrypt(validUnknown),
			payloadHash: crypto.createHash("sha256").update(validUnknown).digest("hex"),
			signatureHash: "fixture",
			status: "PROCESSING",
			attempts: 1,
			leaseUntil: new Date(Date.now() - 1_000),
		},
	})
	const poisonRaw = JSON.stringify({ event: "subscription.activated" })
	const poison = await prisma.billingWebhookEvent.create({
		data: {
			eventId: `evt_${crypto.randomUUID()}`,
			eventType: "subscription.activated",
			payloadCiphertext: encrypt(poisonRaw),
			payloadHash: crypto.createHash("sha256").update(poisonRaw).digest("hex"),
			signatureHash: "fixture",
		},
	})
	try {
		await billingService.processWebhookEvent(expiredLease.id)
		assert.equal((await prisma.billingWebhookEvent.findUniqueOrThrow({ where: { id: expiredLease.id } })).status, "IGNORED")
		await assert.rejects(() => billingService.processWebhookEvent(poison.id))
		const failed = await prisma.billingWebhookEvent.findUniqueOrThrow({ where: { id: poison.id } })
		assert.equal(failed.status, "FAILED")
		assert.equal(failed.errorCode, "INVALID_PAYLOAD")
		assert.equal(failed.leaseUntil, null)
		assert.doesNotMatch(failed.errorMessage ?? "", /subscription|payload/i)
	} finally {
		await prisma.billingWebhookEvent.deleteMany({ where: { id: { in: [expiredLease.id, poison.id] } } })
	}
})

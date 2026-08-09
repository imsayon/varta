import { prisma } from "@/infra/database/prisma.ts"
import { env } from "@/common/config/env.ts"
import { logger } from "@/infra/observability/logger.ts"
import { billingEvents } from "@/infra/observability/metrics.ts"
import { ForbiddenError, NotFoundError, TooManyRequestsError, BadRequestError } from "@/common/errors/app-error.ts"
import { BILLING_CATALOG, type BillingPlanId } from "./billing.constants.ts"
import {
	canTransitionSubscription,
	deriveEntitlements,
	evaluateQuotaUsage,
	type AccountEntitlement,
	type SubscriptionStatus,
} from "./billing-state.ts"
import { razorpayClient } from "./razorpay.client.ts"

export const billingService = {
	/**
	 * Get or create a billing account for a user and link to workspace
	 */
	async getOrCreateBillingAccount(userId: string, workspaceId: string) {
		// Check existing workspace mapping
		const existingLink = await prisma.billingAccountWorkspace.findUnique({
			where: { workspaceId },
			include: { billingAccount: { include: { subscriptions: true } } },
		})

		if (existingLink) {
			return existingLink.billingAccount
		}

		// Create a new billing account owned by user
		const billingAccount = await prisma.billingAccount.create({
			data: {
				ownerUserId: userId,
				workspaces: {
					create: { workspaceId },
				},
				subscriptions: {
					create: {
						planId: "free",
						status: "ACTIVE",
					},
				},
			},
			include: { subscriptions: true },
		})

		return billingAccount
	},

	/**
	 * Gets active entitlement for a workspace
	 */
	async getWorkspaceEntitlements(workspaceId: string): Promise<AccountEntitlement> {
		const link = await prisma.billingAccountWorkspace.findUnique({
			where: { workspaceId },
			include: {
				billingAccount: {
					include: {
						subscriptions: {
							orderBy: { createdAt: "desc" },
							take: 1,
						},
					},
				},
			},
		})

		if (!link || link.billingAccount.subscriptions.length === 0) {
			// Default to Free active plan
			return deriveEntitlements("free", "ACTIVE")
		}

		const sub = link.billingAccount.subscriptions[0]
		const status = (sub?.status ?? "ACTIVE") as SubscriptionStatus
		const planId = (sub?.planId ?? "free") as BillingPlanId
		return deriveEntitlements(planId, status, sub?.graceExpiresAt ?? undefined)
	},

	/**
	 * Reserve quota atomically before notification acceptance.
	 * Returns current balance and throws TooManyRequestsError if monthly notification quota is exceeded.
	 */
	async reserveQuota(workspaceId: string, operationId: string, requestedUnits = 1): Promise<number> {
		const entitlement = await this.getWorkspaceEntitlements(workspaceId)

		if (!entitlement.canAcceptNotifications) {
			billingEvents.inc({ event: "quota_denied", outcome: "forbidden" })
			throw new ForbiddenError("Subscription is expired or inactive; cannot accept notifications")
		}

		// Resolve billing account ID
		const link = await prisma.billingAccountWorkspace.findUnique({
			where: { workspaceId },
		})

		if (!link) {
			// Workspaces without explicit billing account default to free limits
			return requestedUnits
		}

		const billingAccountId = link.billingAccountId

		// Check idempotent duplicate operation
		const existingLedger = await prisma.usageLedger.findUnique({
			where: { operationId },
		})

		if (existingLedger) {
			return existingLedger.balanceAfter
		}

		// Calculate current month's total usage
		const startOfMonth = new Date()
		startOfMonth.setDate(1)
		startOfMonth.setHours(0, 0, 0, 0)

		const agg = await prisma.usageLedger.aggregate({
			where: {
				billingAccountId,
				createdAt: { gte: startOfMonth },
			},
			_sum: { deltaUnits: true },
		})

		const currentMonthlyUsage = agg._sum.deltaUnits ?? 0
		const maxLimit = entitlement.limits.maxNotificationRunsPerMonth

		const evaluation = evaluateQuotaUsage(currentMonthlyUsage + requestedUnits, maxLimit)

		if (evaluation.isExceeded) {
			billingEvents.inc({ event: "quota_exceeded", outcome: "rate_limited" })
			throw new TooManyRequestsError(
				`Monthly notification quota exceeded (${currentMonthlyUsage}/${maxLimit} runs). Upgrade plan to continue.`,
			)
		}

		// Log warning metrics if passing threshold
		if (evaluation.warningLevel !== "none") {
			billingEvents.inc({ event: `warning_${evaluation.warningLevel}`, outcome: "warn" })
		}

		// Append-only usage ledger entry
		const balanceAfter = currentMonthlyUsage + requestedUnits
		await prisma.usageLedger.create({
			data: {
				billingAccountId,
				workspaceId,
				operationId,
				deltaUnits: requestedUnits,
				balanceAfter,
				description: `Notification trigger run (${requestedUnits} units)`,
			},
		})

		billingEvents.inc({ event: "quota_reserved", outcome: "success" })
		return balanceAfter
	},

	/**
	 * Process raw webhook event from Razorpay idempotently
	 */
	async ingestWebhookEvent(rawBody: string, signature: string): Promise<{ eventId: string; status: string }> {
		const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET

		if (webhookSecret && !razorpayClient.verifyWebhookSignature(rawBody, signature, webhookSecret)) {
			billingEvents.inc({ event: "webhook_signature_failed", outcome: "unauthorized" })
			throw new BadRequestError("Invalid Razorpay webhook signature")
		}

		let payload: { event?: string; payload?: { subscription?: { entity?: { id?: string; plan_id?: string } } } }
		try {
			payload = JSON.parse(rawBody)
		} catch {
			throw new BadRequestError("Invalid JSON payload in webhook")
		}

		const eventId = (payload as Record<string, unknown>).id as string || `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`
		const eventType = payload.event ?? "unknown"

		// Deduplicate event ID
		const existing = await prisma.billingWebhookEvent.findUnique({
			where: { eventId },
		})

		if (existing) {
			billingEvents.inc({ event: "webhook_duplicate", outcome: "ignored" })
			return { eventId, status: existing.status }
		}

		// Persist raw event to inbox
		const record = await prisma.billingWebhookEvent.create({
			data: {
				eventId,
				eventType,
				rawPayload: rawBody,
				signature,
				status: "PENDING",
			},
		})

		// Process transition asynchronously / synchronously
		await this.processWebhookEvent(record.id)

		billingEvents.inc({ event: "webhook_ingested", outcome: "success" })
		return { eventId, status: "PROCESSED" }
	},

	/**
	 * Processes a pending webhook inbox event and updates subscription state machine
	 */
	async processWebhookEvent(inboxRecordId: string): Promise<void> {
		const record = await prisma.billingWebhookEvent.findUnique({
			where: { id: inboxRecordId },
		})

		if (!record || record.status === "PROCESSED") return

		try {
			const body = JSON.parse(record.rawPayload)
			const eventType = record.eventType
			const subscriptionEntity = body?.payload?.subscription?.entity

			if (subscriptionEntity?.id) {
				const razorpaySubId = subscriptionEntity.id as string

				const sub = await prisma.subscription.findUnique({
					where: { razorpaySubscriptionId: razorpaySubId },
				})

				if (sub) {
					let newStatus: SubscriptionStatus = sub.status as SubscriptionStatus

					if (eventType === "subscription.charged" || eventType === "subscription.activated") {
						newStatus = "ACTIVE"
					} else if (eventType === "subscription.halted") {
						newStatus = "GRACE"
					} else if (eventType === "subscription.cancelled") {
						newStatus = "CANCELLED"
					} else if (eventType === "subscription.completed") {
						newStatus = "EXPIRED"
					}

					if (canTransitionSubscription(sub.status as SubscriptionStatus, newStatus)) {
						await prisma.subscription.update({
							where: { id: sub.id },
							data: {
								status: newStatus,
								updatedAt: new Date(),
							},
						})

						// Snapshot entitlement
						const ent = deriveEntitlements(sub.planId as BillingPlanId, newStatus)
						await prisma.entitlementSnapshot.create({
							data: {
								billingAccountId: sub.billingAccountId,
								planId: sub.planId,
								canAcceptNotifications: ent.canAcceptNotifications,
								canAccessAi: ent.canAccessAi,
								limitsJson: ent.limits as unknown as object,
							},
						})
					}
				}
			}

			await prisma.billingWebhookEvent.update({
				where: { id: inboxRecordId },
				data: {
					status: "PROCESSED",
					processedAt: new Date(),
				},
			})
		} catch (err) {
			logger.error({ err, inboxRecordId }, "Failed to process billing webhook event")
			await prisma.billingWebhookEvent.update({
				where: { id: inboxRecordId },
				data: {
					status: "FAILED",
					error: err instanceof Error ? err.message : "Unknown error",
				},
			})
		}
	},

	/**
	 * Initiates checkout for upgrading plan
	 */
	async initiateCheckout(userId: string, workspaceId: string, targetPlanId: BillingPlanId) {
		const plan = BILLING_CATALOG[targetPlanId]
		if (!plan) {
			throw new BadRequestError(`Invalid plan ID: ${targetPlanId}`)
		}

		const account = await this.getOrCreateBillingAccount(userId, workspaceId)
		let customerId = account.razorpayCustomerId

		if (!customerId) {
			const user = await prisma.user.findUnique({ where: { id: userId } })
			if (!user) throw new NotFoundError("User not found")

			customerId = await razorpayClient.createCustomer({
				name: user.name ?? user.email,
				email: user.email,
			})

			await prisma.billingAccount.update({
				where: { id: account.id },
				data: { razorpayCustomerId: customerId },
			})
		}

		// Create Razorpay subscription or test pending subscription record
		const { subscriptionId } = await razorpayClient.createSubscription({
			planId: plan.razorpayPlanIdInr ?? "plan_test_default",
			notes: {
				billingAccountId: account.id,
				workspaceId,
				planId: targetPlanId,
			},
		})

		// Record pending subscription in database
		await prisma.subscription.create({
			data: {
				billingAccountId: account.id,
				planId: targetPlanId,
				status: "PENDING",
				razorpaySubscriptionId: subscriptionId,
			},
		})

		return {
			billingAccountId: account.id,
			subscriptionId,
			planId: targetPlanId,
			amount: plan.price.inrMonthly,
			currency: "INR",
			keyId: env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
		}
	},
}

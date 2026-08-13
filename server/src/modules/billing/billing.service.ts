import crypto from "node:crypto"
import { Prisma, type Subscription } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/infra/database/prisma.ts"
import { env } from "@/common/config/env.ts"
import { decrypt, encrypt } from "@/common/utils/crypto.util.ts"
import { logger } from "@/infra/observability/logger.ts"
import { billingEvents, billingInboxOldestSeconds, billingSubscriptionDrift } from "@/infra/observability/metrics.ts"
import {
	BadRequestError,
	ForbiddenError,
	NotFoundError,
	ServiceUnavailableError,
	TooManyRequestsError,
} from "@/common/errors/app-error.ts"
import {
	BILLING_CATALOG,
	BILLING_CATALOG_VERSION,
	BILLING_GRACE_PERIOD_MS,
	type BillingPlanId,
} from "./billing.constants.ts"
import {
	canTransitionSubscription,
	deriveEntitlements,
	evaluateQuotaUsage,
	notificationQuotaLimit,
	type AccountEntitlement,
	type SubscriptionStatus,
} from "./billing-state.ts"
import { razorpayClient } from "./razorpay.client.ts"

type Transaction = Prisma.TransactionClient

const webhookSchema = z.object({
	event: z.string().min(1).max(128),
	created_at: z.number().int().nonnegative().optional(),
	payload: z.object({
		subscription: z.object({
			entity: z.object({
				id: z.string().min(1),
				status: z.string().optional(),
				current_start: z.number().int().nonnegative().optional(),
				current_end: z.number().int().nonnegative().optional(),
				ended_at: z.number().int().nonnegative().optional(),
			}).passthrough(),
		}).optional(),
		payment: z.object({
			entity: z.object({ subscription_id: z.string().optional() }).passthrough(),
		}).optional(),
	}).passthrough(),
}).passthrough()

type WebhookPayload = z.infer<typeof webhookSchema>

function sha256(value: string): string {
	return crypto.createHash("sha256").update(value).digest("hex")
}

function asDate(seconds: number | undefined): Date | null {
	return seconds === undefined ? null : new Date(seconds * 1_000)
}

function assertPlanId(value: string): BillingPlanId {
	if (value in BILLING_CATALOG) return value as BillingPlanId
	throw new Error(`Unsupported persisted billing plan: ${value}`)
}

function monthPeriod(now = new Date()): { start: Date; end: Date } {
	return {
		start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
		end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
	}
}

function usagePeriod(subscription: Subscription | null, now = new Date()) {
	if (
		subscription?.currentPeriodStart &&
		subscription.currentPeriodEnd &&
		subscription.currentPeriodStart <= now &&
		subscription.currentPeriodEnd > now
	) {
		return { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd }
	}
	return monthPeriod(now)
}

async function lock(tx: Transaction, key: string): Promise<void> {
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
}

async function getOrCreateAccountTx(tx: Transaction, ownerUserId: string, workspaceId: string) {
	await lock(tx, `billing-owner:${ownerUserId}`)
	const existingLink = await tx.billingAccountWorkspace.findUnique({
		where: { workspaceId },
		include: { billingAccount: { include: { subscriptions: true } } },
	})
	if (existingLink) return existingLink.billingAccount

	let account = await tx.billingAccount.findUnique({
		where: { ownerUserId },
		include: { subscriptions: true, _count: { select: { workspaces: true } } },
	})
	if (!account) {
		account = await tx.billingAccount.create({
			data: {
				ownerUserId,
				workspaces: { create: { workspaceId } },
				subscriptions: {
					create: { planId: "free", planVersion: BILLING_CATALOG_VERSION, status: "ACTIVE" },
				},
			},
			include: { subscriptions: true, _count: { select: { workspaces: true } } },
		})
		return account
	}

	const effective = account.subscriptions
		.filter((subscription) => ["ACTIVE", "GRACE", "PAUSED"].includes(subscription.status))
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
	const planId = effective ? assertPlanId(effective.planId) : "free"
	if (account._count.workspaces >= BILLING_CATALOG[planId].limits.maxWorkspaces) {
		throw new ForbiddenError("Billing account workspace limit reached")
	}
	await tx.billingAccountWorkspace.create({ data: { billingAccountId: account.id, workspaceId } })
	return account
}

export async function linkWorkspaceToBillingAccountTx(
	tx: Transaction,
	ownerUserId: string,
	workspaceId: string,
) {
	return getOrCreateAccountTx(tx, ownerUserId, workspaceId)
}

async function resolveBillingContextTx(tx: Transaction, workspaceId: string) {
	await lock(tx, `billing-workspace:${workspaceId}`)
	let link = await tx.billingAccountWorkspace.findUnique({
		where: { workspaceId },
		include: { billingAccount: { include: { subscriptions: { orderBy: { createdAt: "desc" } } } } },
	})
	if (!link) {
		const owner = await tx.workspaceMember.findFirst({
			where: { workspaceId, role: "OWNER" },
			select: { userId: true },
		})
		if (!owner) throw new ForbiddenError("Workspace has no billing owner")
		await getOrCreateAccountTx(tx, owner.userId, workspaceId)
		link = await tx.billingAccountWorkspace.findUniqueOrThrow({
			where: { workspaceId },
			include: { billingAccount: { include: { subscriptions: { orderBy: { createdAt: "desc" } } } } },
		})
	}
	const subscription = link.billingAccount.subscriptions.find((candidate) =>
		["ACTIVE", "GRACE", "PAUSED"].includes(candidate.status),
	) ?? null
	const planId = subscription ? assertPlanId(subscription.planId) : "free"
	return { account: link.billingAccount, subscription, planId }
}

export async function reserveNotificationQuotaTx(
	tx: Transaction,
	workspaceId: string,
	operationId: string,
	requestedUnits = 1,
): Promise<number> {
	const context = await resolveBillingContextTx(tx, workspaceId)
	await lock(tx, `billing-account:${context.account.id}`)
	const durableOperationId = `notification:${workspaceId}:${operationId}`
	const existing = await tx.usageLedger.findUnique({ where: { operationId: durableOperationId } })
	if (existing) return existing.balanceAfter

	const entitlement = deriveEntitlements(
		context.planId,
		(context.subscription?.status ?? "ACTIVE") as SubscriptionStatus,
		context.subscription?.graceExpiresAt ?? undefined,
	)
	if (!entitlement.canAcceptNotifications) {
		billingEvents.inc({ event: "quota_denied", outcome: "forbidden" })
		throw new ForbiddenError("Subscription is inactive; notification acceptance is disabled")
	}

	const period = usagePeriod(context.subscription)
	const aggregate = await tx.usageLedger.aggregate({
		where: {
			billingAccountId: context.account.id,
			kind: { in: ["NOTIFICATION_RESERVATION", "NOTIFICATION_COMPENSATION"] },
			periodStart: period.start,
		},
		_sum: { deltaUnits: true },
	})
	const currentUsage = aggregate._sum.deltaUnits ?? 0
	const nextUsage = currentUsage + requestedUnits
	const effectiveLimit = notificationQuotaLimit(context.planId)
	if (nextUsage > effectiveLimit) {
		billingEvents.inc({ event: "quota_exceeded", outcome: "rate_limited" })
		throw new TooManyRequestsError(
			`Monthly notification quota exceeded (${currentUsage}/${effectiveLimit} runs)`,
		)
	}
	const warning = evaluateQuotaUsage(nextUsage, BILLING_CATALOG[context.planId].limits.maxNotificationRunsPerMonth)
	if (warning.warningLevel !== "none") {
		billingEvents.inc({ event: `warning_${warning.warningLevel}`, outcome: "warn" })
	}
	await tx.usageLedger.create({
		data: {
			billingAccountId: context.account.id,
			workspaceId,
			operationId: durableOperationId,
			kind: "NOTIFICATION_RESERVATION",
			deltaUnits: requestedUnits,
			balanceAfter: nextUsage,
			periodStart: period.start,
			periodEnd: period.end,
			description: "Durably accepted notification trigger",
		},
	})
	billingEvents.inc({ event: "quota_reserved", outcome: "success" })
	return nextUsage
}

export async function assertSubscriberCapacityTx(tx: Transaction, workspaceId: string): Promise<void> {
	const context = await resolveBillingContextTx(tx, workspaceId)
	await lock(tx, `billing-account:${context.account.id}`)
	const count = await tx.subscriber.count({
		where: {
			workspace: {
				billingWorkspaces: { some: { billingAccountId: context.account.id } },
			},
		},
	})
	if (count >= BILLING_CATALOG[context.planId].limits.maxSubscribers) {
		billingEvents.inc({ event: "subscriber_limit_denied", outcome: "forbidden" })
		throw new ForbiddenError("Billing account subscriber limit reached")
	}
}

export async function assertMemberCapacityTx(tx: Transaction, workspaceId: string): Promise<void> {
	const context = await resolveBillingContextTx(tx, workspaceId)
	await lock(tx, `billing-account:${context.account.id}`)
	const limit = BILLING_CATALOG[context.planId].limits.maxMembers
	const members = await tx.workspaceMember.findMany({
		where: {
			workspace: {
				billingWorkspaces: { some: { billingAccountId: context.account.id } },
			},
		},
		select: { userId: true },
		distinct: ["userId"],
		take: limit,
	})
	if (members.length >= limit) {
		billingEvents.inc({ event: "member_limit_denied", outcome: "forbidden" })
		throw new ForbiddenError("Billing account member limit reached")
	}
}

export async function reserveAiQuotaTx(
	tx: Transaction,
	workspaceId: string,
	operationId: string,
): Promise<number> {
	const context = await resolveBillingContextTx(tx, workspaceId)
	await lock(tx, `billing-account:${context.account.id}`)
	const durableOperationId = `ai:${workspaceId}:${operationId}`
	const existing = await tx.usageLedger.findUnique({ where: { operationId: durableOperationId } })
	if (existing) return existing.balanceAfter
	const entitlement = deriveEntitlements(
		context.planId,
		(context.subscription?.status ?? "ACTIVE") as SubscriptionStatus,
		context.subscription?.graceExpiresAt ?? undefined,
	)
	if (!entitlement.canAccessAi) throw new ForbiddenError("AI is not included in the active entitlement")
	const period = usagePeriod(context.subscription)
	const aggregate = await tx.usageLedger.aggregate({
		where: {
			billingAccountId: context.account.id,
			kind: { in: ["AI_RESERVATION", "AI_COMPENSATION"] },
			periodStart: period.start,
		},
		_sum: { deltaUnits: true },
	})
	const currentUsage = aggregate._sum.deltaUnits ?? 0
	const nextUsage = currentUsage + 1
	if (nextUsage > BILLING_CATALOG[context.planId].limits.maxAiRequestsPerMonth) {
		billingEvents.inc({ event: "ai_quota_exceeded", outcome: "rate_limited" })
		throw new TooManyRequestsError("Monthly AI request quota exceeded")
	}
	await tx.usageLedger.create({
		data: {
			billingAccountId: context.account.id,
			workspaceId,
			operationId: durableOperationId,
			kind: "AI_RESERVATION",
			deltaUnits: 1,
			balanceAfter: nextUsage,
			periodStart: period.start,
			periodEnd: period.end,
			description: "Authorized AI gateway request",
		},
	})
	return nextUsage
}

function webhookStatus(eventType: string): SubscriptionStatus | null {
	switch (eventType) {
		case "subscription.activated":
		case "subscription.active":
		case "subscription.authenticated":
		case "subscription.charged":
		case "subscription.resumed":
			return "ACTIVE"
		case "subscription.pending":
		case "payment.failed":
			return "GRACE"
		case "subscription.paused":
		case "subscription.halted":
			return "PAUSED"
		case "subscription.cancelled":
			return "CANCELLED"
		case "subscription.completed":
		case "subscription.expired":
			return "EXPIRED"
		case "subscription.created":
			return "PENDING"
		default:
			return null
	}
}

async function applyWebhookProjection(tx: Transaction, recordId: string, payload: WebhookPayload): Promise<"PROCESSED" | "IGNORED"> {
	const record = await tx.billingWebhookEvent.findUniqueOrThrow({ where: { id: recordId } })
	const entity = payload.payload.subscription?.entity
	const subscriptionId = entity?.id ?? payload.payload.payment?.entity.subscription_id
	const nextStatus = webhookStatus(payload.event)
	if (!subscriptionId || !nextStatus) return "IGNORED"

	const subscription = await tx.subscription.findUnique({ where: { razorpaySubscriptionId: subscriptionId } })
	if (!subscription) return "IGNORED"
	await lock(tx, `billing-subscription:${subscription.id}`)
	const providerCreatedAt = asDate(payload.created_at) ?? record.createdAt
	if (subscription.providerUpdatedAt && providerCreatedAt < subscription.providerUpdatedAt) return "IGNORED"
	if (!canTransitionSubscription(subscription.status as SubscriptionStatus, nextStatus)) return "IGNORED"

	const graceExpiresAt = nextStatus === "GRACE"
		? new Date(providerCreatedAt.getTime() + BILLING_GRACE_PERIOD_MS)
		: nextStatus === "ACTIVE" ? null : subscription.graceExpiresAt
	const updated = await tx.subscription.update({
		where: { id: subscription.id },
		data: {
			status: nextStatus,
			providerStatus: entity?.status ?? nextStatus.toLowerCase(),
			providerUpdatedAt: providerCreatedAt,
			lastEventId: record.eventId,
			currentPeriodStart: asDate(entity?.current_start) ?? subscription.currentPeriodStart,
			currentPeriodEnd: asDate(entity?.current_end) ?? subscription.currentPeriodEnd,
			graceExpiresAt,
		},
	})
	const planId = assertPlanId(updated.planId)
	const entitlement = deriveEntitlements(planId, nextStatus, updated.graceExpiresAt ?? undefined)
	await tx.entitlementSnapshot.create({
		data: {
			billingAccountId: updated.billingAccountId,
			planId,
			planVersion: updated.planVersion,
			sourceEventId: record.eventId,
			canAcceptNotifications: entitlement.canAcceptNotifications,
			canAccessAi: entitlement.canAccessAi,
			limitsJson: entitlement.limits as unknown as Prisma.InputJsonValue,
		},
	})
	await tx.billingAuditEvent.create({
		data: {
			billingAccountId: updated.billingAccountId,
			action: "subscription.transition",
			actorType: "razorpay_webhook",
			sourceEventId: record.eventId,
			details: { from: subscription.status, to: nextStatus, eventType: payload.event },
		},
	})
	billingEvents.inc({ event: "subscription_transition", outcome: "success" })
	return "PROCESSED"
}

function checkoutPlanId(planId: BillingPlanId): string {
	if (env.RAZORPAY_MODE === "disabled") throw new ServiceUnavailableError("Razorpay billing is disabled")
	if (planId === "plus") return env.RAZORPAY_PLUS_PLAN_ID_INR
	if (planId === "business") return env.RAZORPAY_BUSINESS_PLAN_ID_INR
	throw new BadRequestError("Free plan does not require checkout")
}

async function enqueueBillingWebhook(inboxRecordId: string): Promise<void> {
	const { queueService } = await import("@/infra/queues/queue.service.ts")
	await queueService.enqueueBillingWebhook({ version: 1, kind: "event", inboxRecordId })
}

export const billingService = {
	async getOrCreateBillingAccount(userId: string, workspaceId: string) {
		return prisma.$transaction((tx) => getOrCreateAccountTx(tx, userId, workspaceId))
	},

	async getWorkspaceEntitlements(workspaceId: string): Promise<AccountEntitlement> {
		return prisma.$transaction(async (tx) => {
			const context = await resolveBillingContextTx(tx, workspaceId)
			return deriveEntitlements(
				context.planId,
				(context.subscription?.status ?? "ACTIVE") as SubscriptionStatus,
				context.subscription?.graceExpiresAt ?? undefined,
			)
		})
	},

	async getBillingOverview(workspaceId: string) {
		return prisma.$transaction(async (tx) => {
			const context = await resolveBillingContextTx(tx, workspaceId)
			const period = usagePeriod(context.subscription)
			const aggregate = await tx.usageLedger.aggregate({
				where: {
					billingAccountId: context.account.id,
					kind: { in: ["NOTIFICATION_RESERVATION", "NOTIFICATION_COMPENSATION"] },
					periodStart: period.start,
				},
				_sum: { deltaUnits: true },
			})
			const pending = context.account.subscriptions.find((candidate) => candidate.status === "PENDING") ?? null
			return {
				entitlement: deriveEntitlements(
					context.planId,
					(context.subscription?.status ?? "ACTIVE") as SubscriptionStatus,
					context.subscription?.graceExpiresAt ?? undefined,
				),
				usage: { used: aggregate._sum.deltaUnits ?? 0, periodStart: period.start, periodEnd: period.end },
				subscription: context.subscription,
				pendingSubscription: pending,
				accountReference: context.account.id,
			}
		})
	},

	async reserveQuota(workspaceId: string, operationId: string, requestedUnits = 1): Promise<number> {
		return prisma.$transaction((tx) =>
			reserveNotificationQuotaTx(tx, workspaceId, operationId, requestedUnits))
	},

	async reserveAiQuota(workspaceId: string, operationId: string): Promise<number> {
		return prisma.$transaction((tx) => reserveAiQuotaTx(tx, workspaceId, operationId))
	},

	async ingestWebhookEvent(
		rawBody: string,
		signature: string,
		eventId: string,
	): Promise<{ eventId: string; status: string }> {
		if (!eventId || eventId.length > 128) throw new BadRequestError("Missing or invalid Razorpay event ID")
		if (!env.RAZORPAY_WEBHOOK_SECRET) throw new ServiceUnavailableError("Razorpay webhook is not configured")
		const secrets = [env.RAZORPAY_WEBHOOK_SECRET, env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS].filter(Boolean)
		if (!secrets.some((secret) => razorpayClient.verifyWebhookSignature(rawBody, signature, secret))) {
			billingEvents.inc({ event: "webhook_signature_failed", outcome: "unauthorized" })
			throw new BadRequestError("Invalid Razorpay webhook signature")
		}
		let decoded: unknown
		try {
			decoded = JSON.parse(rawBody)
		} catch {
			throw new BadRequestError("Invalid Razorpay webhook JSON")
		}
		const payload = webhookSchema.safeParse(decoded)
		if (!payload.success) throw new BadRequestError("Invalid Razorpay webhook payload")
		if (payload.data.event.length > 128) throw new BadRequestError("Razorpay event type is too long")

		const existing = await prisma.billingWebhookEvent.findUnique({ where: { eventId } })
		if (existing) {
			billingEvents.inc({ event: "webhook_duplicate", outcome: "ignored" })
			return { eventId, status: existing.status }
		}
		let record
		try {
			record = await prisma.billingWebhookEvent.create({
				data: {
				eventId,
				eventType: payload.data.event,
				payloadCiphertext: encrypt(rawBody),
				payloadHash: sha256(rawBody),
				signatureHash: sha256(signature),
				providerCreatedAt: asDate(payload.data.created_at),
			},
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
				const duplicate = await prisma.billingWebhookEvent.findUniqueOrThrow({ where: { eventId } })
				billingEvents.inc({ event: "webhook_duplicate", outcome: "ignored" })
				return { eventId, status: duplicate.status }
			}
			throw error
		}
		try {
			await enqueueBillingWebhook(record.id)
		} catch (error) {
			logger.warn({ err: error, inboxRecordId: record.id }, "Billing event persisted; queue publication deferred")
		}
		billingEvents.inc({ event: "webhook_ingested", outcome: "success" })
		return { eventId, status: record.status }
	},

	async processWebhookEvent(inboxRecordId: string): Promise<void> {
		const now = new Date()
		const claimed = await prisma.billingWebhookEvent.updateMany({
			where: {
				id: inboxRecordId,
				attempts: { lt: 5 },
				OR: [
					{ status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
					{ status: "PROCESSING", leaseUntil: { lt: now } },
				],
			},
			data: {
				status: "PROCESSING",
				claimedAt: now,
				leaseUntil: new Date(now.getTime() + 60_000),
				attempts: { increment: 1 },
			},
		})
		if (claimed.count === 0) return
		try {
			await prisma.$transaction(async (tx) => {
				const record = await tx.billingWebhookEvent.findUniqueOrThrow({ where: { id: inboxRecordId } })
				const payload = webhookSchema.parse(JSON.parse(decrypt(record.payloadCiphertext)))
				const status = await applyWebhookProjection(tx, inboxRecordId, payload)
				await tx.billingWebhookEvent.update({
					where: { id: inboxRecordId },
					data: { status, processedAt: new Date(), leaseUntil: null, errorCode: null, errorMessage: null },
				})
			})
			billingEvents.inc({ event: "webhook_processed", outcome: "success" })
		} catch (error) {
			const current = await prisma.billingWebhookEvent.findUnique({ where: { id: inboxRecordId }, select: { attempts: true } })
			const delayMs = Math.min(3_600_000, 1_000 * 2 ** Math.max(0, (current?.attempts ?? 1) - 1))
			await prisma.billingWebhookEvent.update({
				where: { id: inboxRecordId },
				data: {
					status: "FAILED",
					leaseUntil: null,
					availableAt: new Date(Date.now() + delayMs),
					errorCode: error instanceof z.ZodError ? "INVALID_PAYLOAD" : "PROCESSING_FAILED",
					errorMessage: "Billing event processing failed; inspect correlated server logs",
				},
			})
			billingEvents.inc({ event: "webhook_processed", outcome: "failed" })
			logger.error({ err: error, inboxRecordId }, "Billing webhook processing failed")
			throw error
		}
	},

	async recoverPendingWebhookEvents(limit = 100): Promise<number> {
		const now = new Date()
		const records = await prisma.billingWebhookEvent.findMany({
			where: {
				attempts: { lt: 5 },
				OR: [
					{ status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
					{ status: "PROCESSING", leaseUntil: { lt: now } },
				],
			},
			select: { id: true },
			orderBy: { createdAt: "asc" },
			take: Math.min(100, Math.max(1, limit)),
		})
		const oldest = await prisma.billingWebhookEvent.findFirst({
			where: { status: { in: ["PENDING", "FAILED", "PROCESSING"] }, attempts: { lt: 5 } },
			select: { createdAt: true },
			orderBy: { createdAt: "asc" },
		})
		billingInboxOldestSeconds.set(oldest ? Math.max(0, (Date.now() - oldest.createdAt.getTime()) / 1_000) : 0)
		for (const record of records) {
			await enqueueBillingWebhook(record.id)
		}
		return records.length
	},

	async initiateCheckout(userId: string, workspaceId: string, targetPlanId: BillingPlanId, operationId: string) {
		const plan = BILLING_CATALOG[targetPlanId]
		if (!plan || targetPlanId === "free") throw new BadRequestError("Invalid paid plan selection")
		const providerPlanId = checkoutPlanId(targetPlanId)
		const durableOperationId = `checkout:${workspaceId}:${operationId}`
		return prisma.$transaction(async (tx) => {
			await lock(tx, `billing-checkout:${durableOperationId}`)
			const existing = await tx.subscription.findUnique({ where: { checkoutOperationId: durableOperationId } })
			if (existing?.razorpaySubscriptionId) {
				if (existing.planId !== targetPlanId) throw new BadRequestError("Idempotency-Key was already used for another plan")
				return {
					subscriptionId: existing.razorpaySubscriptionId,
					planId: targetPlanId,
					amount: plan.price.inrMonthly,
					currency: "INR" as const,
					keyId: env.RAZORPAY_KEY_ID,
				}
			}
			const account = await getOrCreateAccountTx(tx, userId, workspaceId)
			let customerId = account.razorpayCustomerId
			if (!customerId) {
				const user = await tx.user.findUnique({ where: { id: userId } })
				if (!user) throw new NotFoundError("User not found")
				customerId = await razorpayClient.createCustomer({ name: user.name ?? user.email, email: user.email, failIfExist: true })
				await tx.billingAccount.update({ where: { id: account.id }, data: { razorpayCustomerId: customerId } })
			}
			const created = await razorpayClient.createSubscription({
				planId: providerPlanId,
				notes: { billingAccountId: account.id, workspaceId, planId: targetPlanId, operationId: durableOperationId },
			})
			await tx.subscription.create({
				data: {
					billingAccountId: account.id,
					planId: targetPlanId,
					planVersion: plan.version,
					status: "PENDING",
					checkoutOperationId: durableOperationId,
					razorpaySubscriptionId: created.subscriptionId,
					providerStatus: created.status,
				},
			})
			await tx.billingAuditEvent.create({
				data: {
					billingAccountId: account.id,
					action: "checkout.created",
					actorType: "user",
					actorId: userId,
					details: { planId: targetPlanId, planVersion: plan.version, operationId: durableOperationId },
				},
			})
			return {
				subscriptionId: created.subscriptionId,
				planId: targetPlanId,
				amount: plan.price.inrMonthly,
				currency: "INR" as const,
				keyId: env.RAZORPAY_KEY_ID,
			}
		}, { timeout: env.RAZORPAY_REQUEST_TIMEOUT_MS + 2_000 })
	},

	async verifyCheckoutReturn(workspaceId: string, paymentId: string, subscriptionId: string, signature: string) {
		if (!razorpayClient.verifyCheckoutSignature(paymentId, subscriptionId, signature)) {
			throw new BadRequestError("Invalid Razorpay checkout signature")
		}
		const subscription = await prisma.subscription.findFirst({
			where: { razorpaySubscriptionId: subscriptionId, billingAccount: { workspaces: { some: { workspaceId } } } },
		})
		if (!subscription) throw new NotFoundError("Subscription not found")
		await prisma.billingAuditEvent.create({
			data: {
				billingAccountId: subscription.billingAccountId,
				action: "checkout.signature_verified",
				actorType: "browser_return",
				details: { subscriptionId, paymentReferenceHash: sha256(paymentId) },
			},
		})
		return { verified: true, entitlementPending: true }
	},

	async requestCancellation(workspaceId: string, actorId: string) {
		const subscription = await prisma.subscription.findFirst({
			where: {
				razorpaySubscriptionId: { not: null },
				status: { in: ["ACTIVE", "GRACE", "PAUSED"] },
				billingAccount: { workspaces: { some: { workspaceId } } },
			},
			orderBy: { createdAt: "desc" },
		})
		if (!subscription?.razorpaySubscriptionId) throw new NotFoundError("No active Razorpay subscription to cancel")
		if (!subscription.cancelAtPeriodEnd) {
			await razorpayClient.cancelSubscription(subscription.razorpaySubscriptionId, true)
			await prisma.$transaction([
				prisma.subscription.update({
					where: { id: subscription.id },
					data: { cancelAtPeriodEnd: true },
				}),
				prisma.billingAuditEvent.create({
					data: {
						billingAccountId: subscription.billingAccountId,
						action: "subscription.cancellation_requested",
						actorType: "user",
						actorId,
						details: { subscriptionId: subscription.razorpaySubscriptionId, atPeriodEnd: true },
					},
				}),
			])
		}
		return { cancellationPending: true, entitlementUnchanged: true }
	},

	async reconcileWorkspace(workspaceId: string, actorId: string) {
		const subscription = await prisma.subscription.findFirst({
			where: {
				razorpaySubscriptionId: { not: null },
				billingAccount: { workspaces: { some: { workspaceId } } },
			},
			orderBy: { createdAt: "desc" },
		})
		if (!subscription?.razorpaySubscriptionId) throw new NotFoundError("No Razorpay subscription to reconcile")
		const provider = await razorpayClient.fetchSubscription(subscription.razorpaySubscriptionId)
		const eventType = `subscription.${provider.status}`
		const projectedStatus = webhookStatus(eventType)
		billingSubscriptionDrift.set(projectedStatus && projectedStatus !== subscription.status ? 1 : 0)
		const nowSeconds = Math.floor(Date.now() / 1_000)
		const payload = webhookSchema.parse({
			event: eventType,
			created_at: nowSeconds,
			payload: { subscription: { entity: {
				id: provider.id,
				status: provider.status,
				current_start: provider.current_start,
				current_end: provider.current_end,
				ended_at: provider.ended_at,
			} } },
		})
		const syntheticEventId = `reconcile:${subscription.id}:${crypto.randomUUID()}`
		await prisma.$transaction(async (tx) => {
			const record = await tx.billingWebhookEvent.create({
				data: {
					eventId: syntheticEventId,
					eventType,
					payloadCiphertext: encrypt(JSON.stringify(payload)),
					payloadHash: sha256(JSON.stringify(payload)),
					signatureHash: "reconciliation",
					status: "PROCESSING",
					attempts: 1,
					providerCreatedAt: new Date(nowSeconds * 1_000),
				},
			})
			const status = await applyWebhookProjection(tx, record.id, payload)
			await tx.billingWebhookEvent.update({ where: { id: record.id }, data: { status, processedAt: new Date() } })
			await tx.billingAuditEvent.create({
				data: {
					billingAccountId: subscription.billingAccountId,
					action: "subscription.reconciled",
					actorType: "user",
					actorId,
					sourceEventId: syntheticEventId,
					details: { providerStatus: provider.status },
				},
			})
		})
		billingSubscriptionDrift.set(0)
		return { reconciled: true, reference: syntheticEventId }
	},
}

import express, { type NextFunction, type Request, type Response } from "express"
import { z } from "zod"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { authorize } from "@/common/auth/route-policy.ts"
import { requireCapability } from "@/common/auth/capability.ts"
import { BadRequestError } from "@/common/errors/app-error.ts"
import { sendSuccess } from "@/common/utils/response.ts"
import { BILLING_CATALOG, BILLING_PLANS } from "./billing.constants.ts"
import { billingService } from "./billing.service.ts"

function routeParam(req: Request, name: string): string {
	const value = req.params[name]
	if (typeof value !== "string" || !value) throw new BadRequestError(`Missing ${name}`)
	return value
}

function actorId(req: Request): string {
	const value = requireCapability(req).principal.actorId
	if (!value) throw new BadRequestError("User context missing")
	return value
}

export const razorpayWebhookRouter = express.Router()
razorpayWebhookRouter.post(
	"/api/v1/webhooks/razorpay",
	express.raw({ type: "application/json", limit: "256kb" }),
	authorize("webhook.provider.razorpay"),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!Buffer.isBuffer(req.body)) throw new BadRequestError("Razorpay webhook requires an application/json body")
			const signature = req.header("X-Razorpay-Signature") ?? ""
			const eventId = req.header("X-Razorpay-Event-Id") ?? ""
			const result = await billingService.ingestWebhookEvent(req.body.toString("utf8"), signature, eventId)
			return sendSuccess(req, res, result, 202)
		} catch (error) {
			next(error)
		}
	},
)

const checkoutSchema = z.object({
	planId: z.enum([BILLING_PLANS.PLUS, BILLING_PLANS.BUSINESS]),
})
const verifySchema = z.object({
	razorpayPaymentId: z.string().min(1).max(128),
	razorpaySubscriptionId: z.string().min(1).max(128),
	razorpaySignature: z.string().min(1).max(256),
})

const router = express.Router()
router.use(authenticate)

router.get(
	"/api/v1/workspaces/:workspaceId/billing",
	authorize("billing.read"),
	async (req, res, next) => {
		try {
			const overview = await billingService.getBillingOverview(routeParam(req, "workspaceId"))
			return sendSuccess(req, res, {
				plan: BILLING_CATALOG[overview.entitlement.planId],
				status: overview.entitlement.status,
				entitlements: overview.entitlement,
				usage: overview.usage,
				subscription: overview.subscription && {
					reference: overview.subscription.id,
					providerReference: overview.subscription.razorpaySubscriptionId,
					currentPeriodStart: overview.subscription.currentPeriodStart,
					currentPeriodEnd: overview.subscription.currentPeriodEnd,
					cancelAtPeriodEnd: overview.subscription.cancelAtPeriodEnd,
				},
				pendingSubscription: overview.pendingSubscription && {
					reference: overview.pendingSubscription.id,
					planId: overview.pendingSubscription.planId,
				},
				accountReference: overview.accountReference,
				catalog: Object.values(BILLING_CATALOG),
			})
		} catch (error) {
			next(error)
		}
	},
)

router.post(
	"/api/v1/workspaces/:workspaceId/billing/checkout",
	authorize("billing.checkout"),
	async (req, res, next) => {
		try {
			const parsed = checkoutSchema.safeParse(req.body)
			if (!parsed.success) throw new BadRequestError("Invalid plan selection")
			const operationId = req.header("Idempotency-Key")
			if (!operationId || operationId.length > 128) throw new BadRequestError("A valid Idempotency-Key is required")
			const checkout = await billingService.initiateCheckout(
				actorId(req),
				routeParam(req, "workspaceId"),
				parsed.data.planId,
				operationId,
			)
			return sendSuccess(req, res, checkout, 201)
		} catch (error) {
			next(error)
		}
	},
)

router.post(
	"/api/v1/workspaces/:workspaceId/billing/checkout/verify",
	authorize("billing.checkout.verify"),
	async (req, res, next) => {
		try {
			const parsed = verifySchema.safeParse(req.body)
			if (!parsed.success) throw new BadRequestError("Invalid checkout verification response")
			const result = await billingService.verifyCheckoutReturn(
				routeParam(req, "workspaceId"),
				parsed.data.razorpayPaymentId,
				parsed.data.razorpaySubscriptionId,
				parsed.data.razorpaySignature,
			)
			return sendSuccess(req, res, result)
		} catch (error) {
			next(error)
		}
	},
)

router.post(
	"/api/v1/workspaces/:workspaceId/billing/reconcile",
	authorize("billing.reconcile"),
	async (req, res, next) => {
		try {
			const result = await billingService.reconcileWorkspace(
				routeParam(req, "workspaceId"),
				actorId(req),
			)
			return sendSuccess(req, res, result, 202)
		} catch (error) {
			next(error)
		}
	},
)

router.post(
	"/api/v1/workspaces/:workspaceId/billing/cancel",
	authorize("billing.cancel"),
	async (req, res, next) => {
		try {
			const result = await billingService.requestCancellation(
				routeParam(req, "workspaceId"),
				actorId(req),
			)
			return sendSuccess(req, res, result, 202)
		} catch (error) {
			next(error)
		}
	},
)

export default router

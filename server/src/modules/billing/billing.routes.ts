import express, { type Request, type Response, type NextFunction } from "express"
import { z } from "zod"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { authorize } from "@/common/auth/route-policy.ts"
import { sendSuccess } from "@/common/utils/response.ts"
import { BadRequestError } from "@/common/errors/app-error.ts"
import { billingService } from "./billing.service.ts"
import { BILLING_CATALOG, BILLING_PLANS, type BillingPlanId } from "./billing.constants.ts"

const router = express.Router()

/**
 * Public Webhook Ingestion for Razorpay
 * Mounts raw body before JSON parsing
 */
router.post(
	"/api/v1/webhooks/razorpay",
	express.raw({ type: "application/json" }),
	authorize("webhook.provider.razorpay"),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const signature = (req.headers["x-razorpay-signature"] as string) || ""
			const rawBody = typeof req.body === "string" ? req.body : req.body?.toString?.("utf-8") || ""

			const result = await billingService.ingestWebhookEvent(rawBody, signature)
			return sendSuccess(req, res, result)
		} catch (err) {
			next(err)
		}
	},
)

/**
 * Owner-only billing overview
 */
router.get(
	"/api/v1/workspaces/:workspaceId/billing",
	authenticate,
	authorize("billing.read"),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { workspaceId } = req.params
			const entitlement = await billingService.getWorkspaceEntitlements(workspaceId!)

			return sendSuccess(req, res, {
				plan: BILLING_CATALOG[entitlement.planId],
				status: entitlement.status,
				entitlements: entitlement,
				catalog: Object.values(BILLING_CATALOG),
			})
		} catch (err) {
			next(err)
		}
	},
)

const checkoutSchema = z.object({
	planId: z.enum([BILLING_PLANS.FREE, BILLING_PLANS.PLUS, BILLING_PLANS.BUSINESS]),
})

/**
 * Owner-only Razorpay checkout initiation
 */
router.post(
	"/api/v1/workspaces/:workspaceId/billing/checkout",
	authenticate,
	authorize("billing.checkout"),
	express.json(),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { workspaceId } = req.params
			const userId = (req as any).user?.id || (req as any).principal?.userId

			if (!userId) {
				throw new BadRequestError("User context missing")
			}

			const parsed = checkoutSchema.safeParse(req.body)
			if (!parsed.success) {
				throw new BadRequestError("Invalid plan selection")
			}

			const checkout = await billingService.initiateCheckout(userId, workspaceId!, parsed.data.planId as BillingPlanId)
			return sendSuccess(req, res, checkout)
		} catch (err) {
			next(err)
		}
	},
)

export default router

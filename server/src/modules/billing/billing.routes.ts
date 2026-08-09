import express, { type Request, type Response, type NextFunction } from "express"
import { z } from "zod"
import { requireAuth } from "@/common/middleware/auth.middleware.ts"
import { requireWorkspaceRole } from "@/common/middleware/tenant-isolation.middleware.ts"
import { declareRoutePolicy } from "@/common/auth/route-policy.ts"
import { successResponse } from "@/common/utils/api-response.ts"
import { BadRequestError } from "@/common/errors/app-error.ts"
import { billingService } from "./billing.service.ts"
import { BILLING_CATALOG, BILLING_PLANS, type BillingPlanId } from "./billing.constants.ts"

const router = express.Router()

// Declare public webhook route policy
declareRoutePolicy("/api/v1/webhooks/razorpay", {
	method: "POST",
	policy: "PUBLIC",
	description: "Public verified Razorpay payment webhook endpoint",
})

/**
 * Public Webhook Ingestion for Razorpay
 * Mounts raw body before JSON parsing
 */
router.post(
	"/api/v1/webhooks/razorpay",
	express.raw({ type: "application/json" }),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const signature = (req.headers["x-razorpay-signature"] as string) || ""
			const rawBody = typeof req.body === "string" ? req.body : req.body?.toString?.("utf-8") || ""

			const result = await billingService.ingestWebhookEvent(rawBody, signature)
			return res.status(200).json(successResponse(result, "Webhook processed"))
		} catch (err) {
			next(err)
		}
	},
)

// Declare workspace owner billing policy
declareRoutePolicy("/api/v1/workspaces/:workspaceId/billing", {
	method: "GET",
	policy: "JWT_USER",
	description: "Owner-only workspace billing summary, entitlement, and quota usage",
})

/**
 * Owner-only billing overview
 */
router.get(
	"/api/v1/workspaces/:workspaceId/billing",
	requireAuth,
	requireWorkspaceRole(["OWNER"]),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { workspaceId } = req.params
			const entitlement = await billingService.getWorkspaceEntitlements(workspaceId!)

			return res.json(
				successResponse(
					{
						plan: BILLING_CATALOG[entitlement.planId],
						status: entitlement.status,
						entitlements: entitlement,
						catalog: Object.values(BILLING_CATALOG),
					},
					"Billing status retrieved",
				),
			)
		} catch (err) {
			next(err)
		}
	},
)

// Declare workspace checkout policy
declareRoutePolicy("/api/v1/workspaces/:workspaceId/billing/checkout", {
	method: "POST",
	policy: "JWT_USER",
	description: "Owner-only checkout initiation for Razorpay subscription upgrade",
})

const checkoutSchema = z.object({
	planId: z.enum([BILLING_PLANS.FREE, BILLING_PLANS.PLUS, BILLING_PLANS.BUSINESS]),
})

/**
 * Owner-only Razorpay checkout initiation
 */
router.post(
	"/api/v1/workspaces/:workspaceId/billing/checkout",
	requireAuth,
	requireWorkspaceRole(["OWNER"]),
	express.json(),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { workspaceId } = req.params
			const userId = req.workspaceContext?.userId

			if (!userId) {
				throw new BadRequestError("User context missing")
			}

			const parsed = checkoutSchema.safeParse(req.body)
			if (!parsed.success) {
				throw new BadRequestError("Invalid plan selection")
			}

			const checkout = await billingService.initiateCheckout(userId, workspaceId!, parsed.data.planId as BillingPlanId)
			return res.json(successResponse(checkout, "Checkout initiated"))
		} catch (err) {
			next(err)
		}
	},
)

export default router

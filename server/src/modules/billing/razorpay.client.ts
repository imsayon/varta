import crypto from "node:crypto"
import { env } from "@/common/config/env.ts"
import { ServiceUnavailableError, BadRequestError } from "@/common/errors/app-error.ts"
import { logger } from "@/infra/observability/logger.ts"

export interface RazorpayCustomerOptions {
	name: string
	email: string
	failIfExist?: boolean
}

export interface RazorpaySubscriptionOptions {
	planId: string
	totalCount?: number
	customerNotify?: boolean
	notes?: Record<string, string>
}

export const razorpayClient = {
	/**
	 * Verify HMAC signature of inbound Razorpay webhook payload
	 */
	verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
		if (!rawBody || !signature || !webhookSecret) return false
		try {
			const expectedSignature = crypto
				.createHmac("sha256", webhookSecret)
				.update(rawBody)
				.digest("hex")

			return crypto.timingSafeEqual(
				Buffer.from(signature, "utf-8"),
				Buffer.from(expectedSignature, "utf-8"),
			)
		} catch {
			return false
		}
	},

	/**
	 * Creates or retrieves a Razorpay customer ID
	 */
	async createCustomer(options: RazorpayCustomerOptions): Promise<string> {
		const keyId = env.RAZORPAY_KEY_ID
		const keySecret = env.RAZORPAY_KEY_SECRET

		if (!keyId || !keySecret) {
			// In test mode without Razorpay credentials, return deterministic test customer ID
			if (env.NODE_ENV === "test" || env.NODE_ENV === "development") {
				return `cust_test_${crypto.randomBytes(6).toString("hex")}`
			}
			throw new ServiceUnavailableError("Razorpay API credentials not configured")
		}

		try {
			const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")
			const res = await fetch("https://api.razorpay.com/v1/customers", {
				method: "POST",
				headers: {
					Authorization: `Basic ${auth}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: options.name,
					email: options.email,
					fail_existing: options.failIfExist ? 1 : 0,
				}),
			})

			if (!res.ok) {
				const errText = await res.text()
				logger.warn({ status: res.status, err: errText }, "Razorpay create customer failed")
				throw new BadRequestError(`Razorpay customer creation failed: ${res.statusText}`)
			}

			const data = (await res.json()) as { id: string }
			return data.id
		} catch (err) {
			if (err instanceof BadRequestError || err instanceof ServiceUnavailableError) throw err
			logger.error({ err }, "Razorpay API transport error")
			throw new ServiceUnavailableError("Razorpay payment gateway unavailable")
		}
	},

	/**
	 * Creates a subscription in Razorpay
	 */
	async createSubscription(options: RazorpaySubscriptionOptions): Promise<{
		subscriptionId: string
		status: string
	}> {
		const keyId = env.RAZORPAY_KEY_ID
		const keySecret = env.RAZORPAY_KEY_SECRET

		if (!keyId || !keySecret) {
			if (env.NODE_ENV === "test" || env.NODE_ENV === "development") {
				return {
					subscriptionId: `sub_test_${crypto.randomBytes(6).toString("hex")}`,
					status: "created",
				}
			}
			throw new ServiceUnavailableError("Razorpay API credentials not configured")
		}

		try {
			const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")
			const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
				method: "POST",
				headers: {
					Authorization: `Basic ${auth}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					plan_id: options.planId,
					total_count: options.totalCount ?? 12,
					quantity: 1,
					customer_notify: options.customerNotify ? 1 : 0,
					notes: options.notes ?? {},
				}),
			})

			if (!res.ok) {
				const errText = await res.text()
				logger.warn({ status: res.status, err: errText }, "Razorpay create subscription failed")
				throw new BadRequestError("Razorpay subscription creation failed")
			}

			const data = (await res.json()) as { id: string; status: string }
			return {
				subscriptionId: data.id,
				status: data.status,
			}
		} catch (err) {
			if (err instanceof BadRequestError || err instanceof ServiceUnavailableError) throw err
			logger.error({ err }, "Razorpay subscription call failed")
			throw new ServiceUnavailableError("Razorpay payment gateway unavailable")
		}
	},

	/**
	 * Cancels a subscription in Razorpay
	 */
	async cancelSubscription(subscriptionId: string, cancelAtCycleEnd = true): Promise<boolean> {
		const keyId = env.RAZORPAY_KEY_ID
		const keySecret = env.RAZORPAY_KEY_SECRET

		if (!keyId || !keySecret) {
			if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
				return true
			}
			throw new ServiceUnavailableError("Razorpay API credentials not configured")
		}

		try {
			const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")
			const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
				method: "POST",
				headers: {
					Authorization: `Basic ${auth}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
				}),
			})

			return res.ok
		} catch (err) {
			logger.error({ err }, "Razorpay subscription cancellation error")
			return false
		}
	},
}

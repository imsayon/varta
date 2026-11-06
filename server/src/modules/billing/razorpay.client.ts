import crypto from "node:crypto"
import { z } from "zod"
import { env } from "@/common/config/env.ts"
import { BadRequestError, ServiceUnavailableError } from "@/common/errors/app-error.ts"
import { logger } from "@/infra/observability/logger.ts"

const API_ORIGIN = "https://api.razorpay.com"

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

const customerSchema = z.object({ id: z.string().min(1) })
const subscriptionSchema = z.object({
	id: z.string().min(1),
	status: z.string().min(1),
	current_start: z.number().int().nonnegative().nullish(),
	current_end: z.number().int().nonnegative().nullish(),
	ended_at: z.number().int().nonnegative().nullish(),
})

export type RazorpaySubscription = z.infer<typeof subscriptionSchema>
export type RazorpayFetch = typeof fetch

export interface RazorpayRuntimeConfig {
	mode: "disabled" | "test" | "live"
	keyId: string
	keySecret: string
	requestTimeoutMs: number
}

const productionRuntime: RazorpayRuntimeConfig = {
	mode: env.RAZORPAY_MODE,
	keyId: env.RAZORPAY_KEY_ID,
	keySecret: env.RAZORPAY_KEY_SECRET,
	requestTimeoutMs: env.RAZORPAY_REQUEST_TIMEOUT_MS,
}

function parseProviderResponse<T>(schema: z.ZodType<T>, payload: unknown): T {
	const parsed = schema.safeParse(payload)
	if (!parsed.success) {
		logger.warn({ issues: parsed.error.issues.map((issue) => issue.code) }, "Razorpay returned an invalid response contract")
		throw new ServiceUnavailableError("Razorpay returned an invalid response")
	}
	return parsed.data
}

function constantTimeHexEqual(received: string, expected: string): boolean {
	if (!/^[0-9a-f]+$/i.test(received) || received.length !== expected.length) return false
	return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"))
}

export function createRazorpayClient(
	fetchImpl: RazorpayFetch = fetch,
	runtime: RazorpayRuntimeConfig = productionRuntime,
) {
	async function request(path: string, init: RequestInit): Promise<unknown> {
		if (runtime.mode === "disabled") {
			throw new ServiceUnavailableError("Razorpay billing is disabled")
		}
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), runtime.requestTimeoutMs)
		try {
			const auth = Buffer.from(`${runtime.keyId}:${runtime.keySecret}`).toString("base64")
			const response = await fetchImpl(`${API_ORIGIN}${path}`, {
				...init,
				signal: controller.signal,
				headers: {
					Authorization: `Basic ${auth}`,
					"Content-Type": "application/json",
					...init.headers,
				},
			})
			if (!response.ok) {
				logger.warn({ status: response.status, path }, "Razorpay API request rejected")
				if (response.status >= 400 && response.status < 500) {
					throw new BadRequestError("Razorpay rejected the billing request")
				}
				throw new ServiceUnavailableError("Razorpay payment gateway unavailable")
			}
			return await response.json()
		} catch (error) {
			if (error instanceof BadRequestError || error instanceof ServiceUnavailableError) throw error
			logger.error({ err: error, path }, "Razorpay API transport failure")
			throw new ServiceUnavailableError("Razorpay payment gateway unavailable")
		} finally {
			clearTimeout(timer)
		}
	}

	return {
		verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
			if (!rawBody || !signature || !webhookSecret) return false
			const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex")
			return constantTimeHexEqual(signature, expected)
		},

		verifyCheckoutSignature(paymentId: string, subscriptionId: string, signature: string): boolean {
			if (!paymentId || !subscriptionId || !signature || !runtime.keySecret) return false
			const expected = crypto
				.createHmac("sha256", runtime.keySecret)
				.update(`${paymentId}|${subscriptionId}`)
				.digest("hex")
			return constantTimeHexEqual(signature, expected)
		},

		async createCustomer(options: RazorpayCustomerOptions): Promise<string> {
			const payload = await request("/v1/customers", {
				method: "POST",
				body: JSON.stringify({
					name: options.name,
					email: options.email,
					fail_existing: options.failIfExist ? 1 : 0,
				}),
			})
			return parseProviderResponse(customerSchema, payload).id
		},

		async createSubscription(options: RazorpaySubscriptionOptions): Promise<{ subscriptionId: string; status: string }> {
			const payload = await request("/v1/subscriptions", {
				method: "POST",
				body: JSON.stringify({
					plan_id: options.planId,
					total_count: options.totalCount ?? 120,
					quantity: 1,
					customer_notify: options.customerNotify ? 1 : 0,
					notes: options.notes ?? {},
				}),
			})
			const subscription = parseProviderResponse(subscriptionSchema, payload)
			return { subscriptionId: subscription.id, status: subscription.status }
		},

		async fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
			const payload = await request(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "GET" })
			return parseProviderResponse(subscriptionSchema, payload)
		},

		async cancelSubscription(subscriptionId: string, cancelAtCycleEnd = true): Promise<void> {
			await request(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
				method: "POST",
				body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
			})
		},
	}
}

export const razorpayClient = createRazorpayClient()

"use client"

import { useEffect, useState, useCallback } from "react"
import { apiClient } from "@/shared/api/api"
import { useAuth } from "@/shared/auth/auth-context"
import styles from "./BillingDashboard.module.css"

export interface BillingPlan {
	id: string
	name: string
	description: string
	price: {
		inrMonthly: number
		usdMonthly: number
	}
	limits: {
		maxWorkspaces: number
		maxMembers: number
		maxSubscribers: number
		maxNotificationRunsPerMonth: number
		maxRps: number
		aiFeaturesEnabled: boolean
		maxAiRequestsPerMonth: number
	}
}

export interface BillingStatusResponse {
	plan: BillingPlan
	status: string
	entitlements: {
		canAcceptNotifications: boolean
		canAccessAi: boolean
		isGracePeriodActive: boolean
	}
	catalog: BillingPlan[]
	usage: { used: number; periodStart: string; periodEnd: string }
	subscription: {
		reference: string
		providerReference: string | null
		currentPeriodStart: string | null
		currentPeriodEnd: string | null
		cancelAtPeriodEnd: boolean
	} | null
	pendingSubscription: { reference: string; planId: string } | null
	accountReference: string
}

type RazorpayResult = {
	razorpay_payment_id: string
	razorpay_subscription_id: string
	razorpay_signature: string
}

type RazorpayCheckout = {
	open(): void
}

declare global {
	interface Window {
		Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout
	}
}

let checkoutScript: Promise<void> | null = null
function loadCheckoutScript(): Promise<void> {
	if (window.Razorpay) return Promise.resolve()
	if (checkoutScript) return checkoutScript
	checkoutScript = new Promise((resolve, reject) => {
		const script = document.createElement("script")
		script.src = "https://checkout.razorpay.com/v1/checkout.js"
		script.async = true
		script.onload = () => resolve()
		script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded"))
		document.head.appendChild(script)
	})
	return checkoutScript
}

export function BillingDashboard() {
	const { workspace, user } = useAuth()
	const [data, setData] = useState<BillingStatusResponse | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null)
	const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
	const [reconciling, setReconciling] = useState(false)
	const [cancelling, setCancelling] = useState(false)

	const fetchBillingStatus = useCallback(async () => {
		if (!workspace?.id) return
		setLoading(true)
		setError(null)

		const res = await apiClient.get<BillingStatusResponse>(
			`/api/v1/workspaces/${workspace.id}/billing`,
		)

		if (res.success && res.data) {
			setData(res.data)
		} else if (!res.success && res.error) {
			setError(res.error.message || "Failed to load billing status")
		}

		setLoading(false)
	}, [workspace])

	useEffect(() => {
		const timer = window.setTimeout(() => void fetchBillingStatus(), 0)
		return () => window.clearTimeout(timer)
	}, [fetchBillingStatus])

	const handleCheckout = async (planId: string) => {
		if (!workspace?.id) return
		setCheckoutPlanId(planId)
		setCheckoutMessage(null)

		const operationId = crypto.randomUUID()
		const res = await apiClient.post<{
			subscriptionId: string
			amount: number
			currency: string
			keyId: string
		}>(`/api/v1/workspaces/${workspace.id}/billing/checkout`, {
			planId,
		}, { idempotencyKey: operationId, retries: 1 })

		if (res.success && res.data) {
			try {
				await loadCheckoutScript()
				if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable")
				const checkout = new window.Razorpay({
					key: res.data.keyId,
					subscription_id: res.data.subscriptionId,
					name: "Varta",
					description: `${res.data.currency} ${res.data.amount} monthly subscription`,
					prefill: { name: user?.name ?? "", email: user?.email ?? "" },
					handler: async (result: RazorpayResult) => {
						const verification = await apiClient.post<{ verified: boolean; entitlementPending: boolean }>(
							`/api/v1/workspaces/${workspace.id}/billing/checkout/verify`,
							{
								razorpayPaymentId: result.razorpay_payment_id,
								razorpaySubscriptionId: result.razorpay_subscription_id,
								razorpaySignature: result.razorpay_signature,
							},
						)
						setCheckoutMessage(verification.success
							? "Payment response verified. Entitlement will update after the verified webhook arrives."
							: verification.error?.message ?? "Checkout verification failed")
						await fetchBillingStatus()
					},
					modal: { ondismiss: () => setCheckoutMessage("Checkout closed. No entitlement change was made.") },
				})
				checkout.open()
			} catch (checkoutError) {
				setCheckoutMessage(checkoutError instanceof Error ? checkoutError.message : "Checkout failed to open")
			}
		} else if (!res.success && res.error) {
			setCheckoutMessage(res.error.message)
		}

		setCheckoutPlanId(null)
	}

	const handleReconcile = async () => {
		if (!workspace?.id) return
		setReconciling(true)
		const result = await apiClient.post<{ reconciled: boolean }>(
			`/api/v1/workspaces/${workspace.id}/billing/reconcile`,
		)
		setCheckoutMessage(result.success
			? "Billing state reconciled with Razorpay."
			: result.error?.message ?? "Reconciliation failed")
		if (result.success) await fetchBillingStatus()
		setReconciling(false)
	}

	const handleCancellation = async () => {
		if (!workspace?.id) return
		setCancelling(true)
		const result = await apiClient.post<{ cancellationPending: boolean; entitlementUnchanged: boolean }>(
			`/api/v1/workspaces/${workspace.id}/billing/cancel`,
		)
		setCheckoutMessage(result.success
			? "Cancellation is scheduled for the period end. Access changes only after a verified provider event."
			: result.error?.message ?? "Cancellation request failed")
		if (result.success) await fetchBillingStatus()
		setCancelling(false)
	}

	if (workspace && workspace.role !== "OWNER") {
		return <div className={styles.error}>Only the workspace owner can view billing.</div>
	}

	if (loading) {
		return <div className={styles.loading}>Loading billing status...</div>
	}

	if (error) {
		return <div className={styles.error}>{error}</div>
	}

	const currentPlan = data?.plan || data?.catalog?.[0]
	const status = data?.status || "ACTIVE"

	return (
		<div className={styles.container}>
			<header className={styles.header}>
				<h1>Billing &amp; Entitlements</h1>
				<p>Manage subscription plans, quotas, and Razorpay payment details.</p>
			</header>

			<section className={styles.currentCard}>
				<div className={styles.badgeRow}>
					<h2>Current Subscription</h2>
					<span
						className={`${styles.statusBadge} ${
							status === "ACTIVE"
								? styles.statusActive
								: status === "GRACE"
								? styles.statusGrace
								: styles.statusInactive
						}`}
					>
						{status}
					</span>
				</div>

				<div className={styles.planOverview}>
					<h3>{currentPlan?.name}</h3>
					<p>{currentPlan?.description}</p>
					<div className={styles.priceTag}>
						₹{currentPlan?.price.inrMonthly} / month (${currentPlan?.price.usdMonthly} USD)
					</div>
				</div>

				<div className={styles.quotaGrid}>
					<div className={styles.quotaItem}>
						<span className={styles.quotaLabel}>Monthly Notification Runs</span>
						<span className={styles.quotaValue}>
							{data?.usage.used.toLocaleString()} / {currentPlan?.limits.maxNotificationRunsPerMonth.toLocaleString()}
						</span>
					</div>
					<div className={styles.quotaItem}>
						<span className={styles.quotaLabel}>Max RPS</span>
						<span className={styles.quotaValue}>{currentPlan?.limits.maxRps}</span>
					</div>
					<div className={styles.quotaItem}>
						<span className={styles.quotaLabel}>Max Subscribers</span>
						<span className={styles.quotaValue}>
							{currentPlan?.limits.maxSubscribers.toLocaleString()}
						</span>
					</div>
					<div className={styles.quotaItem}>
						<span className={styles.quotaLabel}>AI Optimization &amp; Routing</span>
						<span className={styles.quotaValue}>
							{currentPlan?.limits.aiFeaturesEnabled ? "Enabled" : "Disabled"}
						</span>
					</div>
				</div>
				{data?.pendingSubscription && (
					<p className={styles.pendingText}>Pending checkout for {data.pendingSubscription.planId}. Access changes only after a verified webhook.</p>
				)}
				{data?.subscription?.providerReference && (
					<>
						<p className={styles.pendingText}>Account reference: {data.accountReference} · Provider subscription: {data.subscription.providerReference}</p>
						<button className={styles.secondaryBtn} onClick={() => void handleReconcile()} disabled={reconciling}>
							{reconciling ? "Reconciling..." : "Reconcile with Razorpay"}
						</button>
						{!data.subscription.cancelAtPeriodEnd && (
							<button className={styles.secondaryBtn} onClick={() => void handleCancellation()} disabled={cancelling}>
								{cancelling ? "Scheduling cancellation..." : "Cancel at period end"}
							</button>
						)}
					</>
				)}
			</section>

			{checkoutMessage && (
				<div className={styles.alertMessage}>{checkoutMessage}</div>
			)}

			<section className={styles.catalogSection}>
				<h2>Available Plans</h2>
				<div className={styles.catalogGrid}>
					{(data?.catalog || []).map((p) => (
						<div
							key={p.id}
							className={`${styles.planCard} ${
								p.id === currentPlan?.id ? styles.planCardActive : ""
							}`}
						>
							<h3>{p.name}</h3>
							<p className={styles.planDesc}>{p.description}</p>
							<div className={styles.cardPrice}>
								₹{p.price.inrMonthly} <span className={styles.perMonth}>/mo</span>
							</div>

							<ul className={styles.featureList}>
								<li>Up to {p.limits.maxNotificationRunsPerMonth.toLocaleString()} runs/mo</li>
								<li>Up to {p.limits.maxSubscribers.toLocaleString()} subscribers</li>
								<li>{p.limits.maxRps} requests / sec throughput</li>
								<li>
									{p.limits.aiFeaturesEnabled
										? `AI Enabled (${p.limits.maxAiRequestsPerMonth.toLocaleString()} req/mo)`
										: "No AI features"}
								</li>
							</ul>

							{p.id !== currentPlan?.id ? (
								<button
									className={styles.upgradeBtn}
									onClick={() => void handleCheckout(p.id)}
									disabled={checkoutPlanId === p.id}
								>
									{checkoutPlanId === p.id ? "Processing..." : `Upgrade to ${p.name}`}
								</button>
							) : (
								<div className={styles.currentPlanLabel}>Current Plan</div>
							)}
						</div>
					))}
				</div>
			</section>
		</div>
	)
}

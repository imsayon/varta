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
		maxMembersPerWorkspace: number
		maxSubscribersPerWorkspace: number
		maxNotificationRunsPerMonth: number
		maxRps: number
		aiFeaturesEnabled: boolean
		maxAiRequestsPerMinute: number
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
}

export function BillingDashboard() {
	const { workspace } = useAuth()
	const [data, setData] = useState<BillingStatusResponse | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null)
	const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)

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

		const res = await apiClient.post<{
			subscriptionId: string
			amount: number
			currency: string
		}>(`/api/v1/workspaces/${workspace.id}/billing/checkout`, {
			planId,
		})

		if (res.success && res.data) {
			setCheckoutMessage(
				`Checkout initiated! Subscription ID: ${res.data.subscriptionId} (${res.data.currency} ${res.data.amount})`,
			)
		} else if (!res.success && res.error) {
			setCheckoutMessage(res.error.message)
		}

		setCheckoutPlanId(null)
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
							{currentPlan?.limits.maxNotificationRunsPerMonth.toLocaleString()}
						</span>
					</div>
					<div className={styles.quotaItem}>
						<span className={styles.quotaLabel}>Max RPS</span>
						<span className={styles.quotaValue}>{currentPlan?.limits.maxRps}</span>
					</div>
					<div className={styles.quotaItem}>
						<span className={styles.quotaLabel}>Max Subscribers</span>
						<span className={styles.quotaValue}>
							{currentPlan?.limits.maxSubscribersPerWorkspace.toLocaleString()}
						</span>
					</div>
					<div className={styles.quotaItem}>
						<span className={styles.quotaLabel}>AI Optimization &amp; Routing</span>
						<span className={styles.quotaValue}>
							{currentPlan?.limits.aiFeaturesEnabled ? "Enabled" : "Disabled"}
						</span>
					</div>
				</div>
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
								<li>Up to {p.limits.maxSubscribersPerWorkspace.toLocaleString()} subscribers</li>
								<li>{p.limits.maxRps} requests / sec throughput</li>
								<li>
									{p.limits.aiFeaturesEnabled
										? `AI Enabled (${p.limits.maxAiRequestsPerMinute} req/min)`
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

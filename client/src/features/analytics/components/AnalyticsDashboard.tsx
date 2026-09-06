"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { Activity, AlertCircle, Clock, TrendingUp } from "lucide-react"
import { apiClient } from "@/shared/api/api"
import { useAuth } from "@/shared/auth/auth-context"
import type {
	IAnalyticsChannel,
	IAnalyticsOverview,
	IAnalyticsTimelinePoint,
} from "@/shared/types/domain"
import styles from "./AnalyticsDashboard.module.css"

export function AnalyticsDashboard() {
	const { workspace } = useAuth()
	const [timeRange, setTimeRange] = useState("30d")
	const [loading, setLoading] = useState(true)
	const [overview, setOverview] = useState<IAnalyticsOverview | null>(null)
	const [channels, setChannels] = useState<IAnalyticsChannel[]>([])
	const [timeline, setTimeline] = useState<IAnalyticsTimelinePoint[]>([])
	const [error, setError] = useState<string | null>(null)

	const fetchAnalytics = useCallback(async () => {
		if (!workspace) return
		setLoading(true)
		setError(null)

		const [overviewRes, channelRes, timelineRes] = await Promise.all([
			apiClient.get<IAnalyticsOverview>(
				`/api/v1/workspaces/${workspace.id}/analytics/overview?timeRange=${timeRange}`,
			),
			apiClient.get<IAnalyticsChannel[]>(
				`/api/v1/workspaces/${workspace.id}/analytics/channel-breakdown?timeRange=${timeRange}`,
			),
			apiClient.get<IAnalyticsTimelinePoint[]>(
				`/api/v1/workspaces/${workspace.id}/analytics/delivery-timeline?timeRange=${timeRange}`,
			),
		])

		if (overviewRes.success && overviewRes.data) setOverview(overviewRes.data)
		if (channelRes.success && channelRes.data) setChannels(channelRes.data)
		if (timelineRes.success && timelineRes.data) setTimeline(timelineRes.data)
		if (!overviewRes.success) {
			setError(overviewRes.error?.message || "Failed to load analytics data")
		}
		setLoading(false)
	}, [workspace, timeRange])

	useEffect(() => {
		const timer = window.setTimeout(() => void fetchAnalytics(), 0)
		return () => window.clearTimeout(timer)
	}, [fetchAnalytics])

	const totalSent = overview?.totalSent ?? 0
	const deliveryRate = overview?.deliveryRate != null
		? `${(overview.deliveryRate * 100).toFixed(1)}%`
		: "0%"
	const failures = overview?.failed ?? 0
	const totalChannelSent = channels.reduce((total, channel) => total + channel.sent, 0)

	const statCards = [
		{ label: "Total sent", value: totalSent.toLocaleString(), icon: Activity, note: `${timeRange} activity` },
		{ label: "Delivery rate", value: deliveryRate, icon: TrendingUp, note: "Successful attempts" },
		{ label: "P99 latency", value: "Not available", icon: Clock, note: "No latency data recorded" },
		{ label: "Failures", value: failures.toLocaleString(), icon: AlertCircle, note: "Failed or DLQ attempts" },
	]

	return (
		<div className={styles.page}>
			<details className={styles.guide}>
				<summary>Start here: send your first notification</summary>
				<p>Create or select a workspace in the sidebar, then follow this journey.</p>
				<ol>
					<li><Link href="/subscribers">Add a subscriber</Link> with an external ID you control.</li>
					<li><Link href="/templates">Create an in-app template</Link> with a title and body.</li>
					<li><Link href="/rules">Add a rule</Link> to select channels using subscriber attributes.</li>
					<li><Link href="/studio">Trigger it in Studio</Link>, immediately or on a short schedule.</li>
					<li><Link href="/notifications">Inspect delivery and attempts</Link>. Acceptance is separate from delivery.</li>
				</ol>
				<p>Configure email or signed webhooks in <Link href="/settings">Settings</Link> first. Templates use their current content when a delivery runs.</p>
				<p>AI rule proposals are optional. {workspace?.role === "OWNER" ? <Link href="/settings/billing">Billing</Link> : "Owner billing"} shows usage; paid checkout and smart timing are unavailable.</p>
			</details>

			<header className={styles.header}>
				<div>
					<h1 className={styles.title}>Analytics Overview</h1>
					<p className={styles.subtitle}>Live delivery metrics for this workspace.</p>
				</div>
				<div className={styles.rangeGroup} role="group" aria-label="Analytics time range">
					{["7d", "30d", "90d"].map((range) => (
						<button
							key={range}
							type="button"
							className={`${styles.rangeButton} ${timeRange === range ? styles.rangeButtonActive : ""}`}
							aria-pressed={timeRange === range}
							onClick={() => setTimeRange(range)}
						>
							{range}
						</button>
					))}
				</div>
			</header>

			{error && <div className={styles.error} role="alert">{error}</div>}

			<div className={styles.statsGrid}>
				{statCards.map((card) => {
					const Icon = card.icon
					return (
						<section className={styles.stat} key={card.label}>
							<div className={styles.statLabel}><Icon size={16} aria-hidden="true" />{card.label}</div>
							<div className={styles.statValue}>{loading ? "…" : card.value}</div>
							<p className={styles.statNote}>{card.note}</p>
						</section>
					)
				})}
			</div>

			<div className={styles.chartsGrid}>
				<section className={styles.chartCard} aria-labelledby="channel-breakdown-title">
					<h2 id="channel-breakdown-title" className={styles.chartTitle}>Channel breakdown</h2>
					{loading ? <p className={styles.muted}>Loading breakdown…</p> : channels.length === 0 ? <p className={styles.muted}>No delivery data for this range.</p> : (
						<div className={styles.channelList}>
							{channels.map((channel) => {
								const percentage = totalChannelSent > 0 ? (channel.sent / totalChannelSent) * 100 : 0
								return (
									<div className={styles.channelRow} key={channel.channel}>
										<div className={styles.channelMeta}><span>{channel.channel}</span><span>{percentage.toFixed(1)}% ({channel.sent.toLocaleString()})</span></div>
										<div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${percentage}%` }} /></div>
									</div>
								)
							})}
						</div>
					)}
				</section>

				<section className={styles.chartCard} aria-labelledby="delivery-timeline-title">
					<h2 id="delivery-timeline-title" className={styles.chartTitle}>Delivery timeline</h2>
					{loading ? <p className={styles.muted}>Loading timeline…</p> : timeline.length === 0 ? <p className={styles.muted}>No timeline data for this range.</p> : (
						<div className={styles.timeline}>
							{timeline.map((item) => (
								<div className={styles.timelineRow} key={item.timestamp}>
									<span>{new Date(item.timestamp).toLocaleDateString()}</span>
									<strong>{item.sent.toLocaleString()} sent</strong>
								</div>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	)
}

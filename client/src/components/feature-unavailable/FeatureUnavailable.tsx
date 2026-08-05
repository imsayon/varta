"use client"

import Link from "next/link"

type FeatureUnavailableProps = {
	title: string
	description: string
}

export function FeatureUnavailable({
	title,
	description,
}: FeatureUnavailableProps) {
	return (
		<div className="dashboard-page dashboard-page-narrow">
			<section className="dashboard-card" style={{ padding: 28 }}>
				<h1 className="dashboard-title">{title}</h1>
				<p className="dashboard-subtitle">{description}</p>
				<p style={{ color: "var(--text-secondary)", marginTop: 20 }}>
					This capability is not available in the production dashboard yet.
				</p>
				<Link className="dashboard-btn-primary" href="/settings">
					Open workspace settings
				</Link>
			</section>
		</div>
	)
}

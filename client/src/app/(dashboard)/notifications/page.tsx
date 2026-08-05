import { FeatureUnavailable } from "@/components/feature-unavailable/FeatureUnavailable"

export default function NotificationsPage() {
	return (
		<FeatureUnavailable
			title="Notifications unavailable"
			description="The dashboard notification feed is disabled until its identity and receipt contract is complete."
		/>
	)
}

import { FeatureUnavailable } from "@/components/feature-unavailable/FeatureUnavailable"

export default function AnalyticsPage() {
	return (
		<FeatureUnavailable
			title="Analytics unavailable"
			description="Live analytics has not completed production verification."
		/>
	)
}

import { FeatureUnavailable } from "@/components/feature-unavailable/FeatureUnavailable"

export default function SubscribersPage() {
	return (
		<FeatureUnavailable
			title="Subscribers unavailable"
			description="Subscriber management is not exposed until its production dashboard contract is complete."
		/>
	)
}

import { FeatureUnavailable } from "@/components/feature-unavailable/FeatureUnavailable"

export default function RulesPage() {
	return (
		<FeatureUnavailable
			title="Routing rules unavailable"
			description="Routing-rule management is not exposed until the dashboard contract is production verified."
		/>
	)
}

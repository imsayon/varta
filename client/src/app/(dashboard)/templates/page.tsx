import { FeatureUnavailable } from "@/components/feature-unavailable/FeatureUnavailable"

export default function TemplatesPage() {
	return (
		<FeatureUnavailable
			title="Templates unavailable"
			description="Template management is not exposed until live API-backed list and edit flows are verified."
		/>
	)
}

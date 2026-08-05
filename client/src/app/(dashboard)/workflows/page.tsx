import { FeatureUnavailable } from "@/components/feature-unavailable/FeatureUnavailable"

export default function WorkflowsPage() {
	return (
		<FeatureUnavailable
			title="Workflows unavailable"
			description="Multi-step workflows are not implemented in the production backend."
		/>
	)
}

"use client"

import { useEffect } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error("Dashboard layout error:", error)
	}, [error])

	return (
		<div className="flex h-[80vh] w-full flex-col items-center justify-center p-6">
			<div className="flex max-w-md flex-col items-center text-center">
				<div className="mb-4 rounded-full bg-red-500/10 p-3 text-red-500">
					<AlertCircle className="h-8 w-8" />
				</div>
				<h2 className="mb-2 text-xl font-semibold tracking-tight text-foreground">
					Something went wrong
				</h2>
				<p className="mb-6 text-sm text-muted-foreground">
					An error occurred while loading this dashboard view. Please try again.
				</p>
				<button
					type="button"
					onClick={() => reset()}
					className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					<RefreshCw className="h-4 w-4" />
					Try Again
				</button>
			</div>
		</div>
	)
}

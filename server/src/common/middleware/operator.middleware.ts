import type { NextFunction, Request, Response } from "express"
import { UnauthorizedError } from "@/common/errors/app-error.ts"
import { env } from "@/common/config/env.ts"
import type { OperatorMetricsPrincipal } from "@/common/auth/principal.ts"

export function authenticateOperatorMetrics(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	const authHeader = req.headers.authorization
	const tokenHeader = req.headers["x-metrics-token"]
	const providedToken = authHeader?.startsWith("Bearer ")
		? authHeader.slice(7)
		: typeof tokenHeader === "string"
			? tokenHeader
			: null

	if (!providedToken || providedToken !== env.METRICS_AUTH_TOKEN) {
		next(new UnauthorizedError("Invalid or missing metrics authentication token"))
		return
	}

	const principal: OperatorMetricsPrincipal = {
		kind: "operator_metrics",
		actorId: "metrics-operator",
		workspaceId: null,
		scopes: ["metrics:read"],
		verification: "verified",
	}
	req.capability = { principal, workspace: null }
	next()
}

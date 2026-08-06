import type { NextFunction, Request, Response } from "express"
import { env } from "@/common/config/env.ts"
import { UnauthorizedError } from "@/common/errors/app-error.ts"
import { verifyWebhookSignature } from "@/modules/providers/webhook.util.ts"
import type { ProviderWebhookPrincipal } from "@/common/auth/principal.ts"

const FIVE_MINUTES_MS = 5 * 60 * 1000

export function authenticateProviderWebhook(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	const timestampHeader = req.header("svix-timestamp") || req.header("x-resend-timestamp")
	const signatureHeader = req.header("svix-signature") || req.header("x-resend-signature")
	const timestampRaw = Number(timestampHeader)
	const timestampMs = timestampRaw < 1e11 ? timestampRaw * 1000 : timestampRaw
	const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(req.body)

	if (
		!timestampHeader ||
		!signatureHeader ||
		!Number.isFinite(timestampRaw) ||
		Math.abs(Date.now() - timestampMs) > FIVE_MINUTES_MS ||
		!verifyWebhookSignature(timestampRaw, rawBody, env.JWT_ACCESS_SECRET, signatureHeader)
	) {
		next(new UnauthorizedError("Invalid webhook signature"))
		return
	}

	const principal: ProviderWebhookPrincipal = {
		kind: "provider_webhook",
		actorId: null,
		workspaceId: null,
		scopes: ["webhooks:provider"],
		verification: "verified",
		provider: "resend",
	}
	req.capability = { principal, workspace: null }
	next()
}

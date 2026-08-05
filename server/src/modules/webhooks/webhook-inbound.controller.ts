import type { Request, Response, NextFunction } from "express"
import { verifyWebhookSignature } from "@/modules/providers/webhook.util.ts"
import { env } from "@/common/config/env.ts"
import { logger } from "@/infra/observability/logger.ts"
import { prisma } from "@/infra/database/prisma.ts"

const FIVE_MINUTES_MS = 5 * 60 * 1000

export const handleResendInboundWebhook = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const timestampHeader =
			req.header("svix-timestamp") || req.header("x-resend-timestamp")
		const signatureHeader =
			req.header("svix-signature") || req.header("x-resend-signature")
		const eventIdHeader =
			req.header("svix-id") || req.header("x-resend-id") || req.body?.id

		if (!timestampHeader || !signatureHeader) {
			res.status(400).json({
				success: false,
				message: "Missing webhook signature headers",
			})
			return
		}

		const timestampRaw = Number(timestampHeader)
		if (Number.isNaN(timestampRaw)) {
			res.status(400).json({
				success: false,
				message: "Invalid timestamp header",
			})
			return
		}

		// Convert unix seconds to milliseconds if needed
		const timestampMs =
			timestampRaw < 1e11 ? timestampRaw * 1000 : timestampRaw
		const now = Date.now()

		if (Math.abs(now - timestampMs) > FIVE_MINUTES_MS) {
			res.status(400).json({
				success: false,
				message: "Webhook timestamp out of tolerance window",
			})
			return
		}

		const secret =
			(env as any).RESEND_WEBHOOK_SECRET || env.JWT_ACCESS_SECRET
		const rawBodyStr = (req as any).rawBody
			? (req as any).rawBody.toString("utf8")
			: typeof req.body === "string"
				? req.body
				: JSON.stringify(req.body)

		const isValid = verifyWebhookSignature(
			timestampRaw,
			rawBodyStr,
			secret,
			signatureHeader,
		)

		if (!isValid) {
			res.status(401).json({
				success: false,
				message: "Invalid webhook signature",
			})
			return
		}

		// Duplicate event processing check
		if (eventIdHeader) {
			try {
				const existing = await prisma.deliveryAttempt.findFirst({
					where: { providerMessageId: String(eventIdHeader) },
				})
				if (existing) {
					logger.info(
						{ eventId: eventIdHeader },
						"Duplicate inbound webhook event received, skipping",
					)
					res.status(200).json({
						success: true,
						message: "Event already processed",
					})
					return
				}
			} catch {
				// Non-fatal if query fails
			}
		}

		logger.info(
			{ event: req.body, eventId: eventIdHeader },
			"Received valid inbound provider webhook event",
		)
		res.status(200).json({
			success: true,
			message: "Webhook event processed",
		})
	} catch (error) {
		next(error)
	}
}

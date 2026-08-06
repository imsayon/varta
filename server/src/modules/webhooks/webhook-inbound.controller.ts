import type { Request, Response, NextFunction } from "express"
import { createHash } from "node:crypto"
import { prisma } from "@/infra/database/prisma.ts"
import { Prisma } from "@prisma/client"
import { sendSuccess } from "@/common/utils/response.ts"

function objectValue(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}
}

export const handleResendInboundWebhook = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const eventId = req.header("svix-id") || req.header("x-resend-id")
		if (!eventId) throw new Error("Verified webhook is missing an event ID")
		const body = objectValue(req.body)
		const data = objectValue(body.data)
		const eventType = typeof body.type === "string" ? body.type : "unknown"
		const providerMessageId =
			typeof data.email_id === "string" ? data.email_id : null
		const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body))
		try {
			await prisma.$transaction(async (tx) => {
				const attempt = providerMessageId
					? await tx.deliveryAttempt.findFirst({
							where: { provider: "resend", providerMessageId },
							select: { id: true },
						})
					: null
				await tx.providerWebhookEvent.create({
					data: {
						provider: "resend",
						eventId,
						eventType,
						providerMessageId,
						payloadHash: createHash("sha256").update(rawBody).digest("hex"),
						matchedAttemptId: attempt?.id ?? null,
					},
				})
				if (attempt) {
					await tx.deliveryAttempt.update({
						where: { id: attempt.id },
						data: { providerResponse: { callbackEvent: eventType, eventId } },
					})
				}
			})
		} catch (error) {
			if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
				throw error
			}
		}
		sendSuccess(req, res, null)
	} catch (error) {
		next(error)
	}
}

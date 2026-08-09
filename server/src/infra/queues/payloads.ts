import { z } from "zod"

const DeliveryJobSchema = z.object({
	version: z.literal(1),
	notificationId: z.string().min(1),
	deliveryId: z.string().min(1),
	workspaceId: z.string().min(1),
	requestId: z.string().max(128).optional(),
	correlationId: z.string().max(128).optional(),
	traceparent: z.string().max(512).optional(),
})

export const SendEmailJobSchema = DeliveryJobSchema
export const SendInAppJobSchema = DeliveryJobSchema
export const SendWebhookJobSchema = DeliveryJobSchema

export const DigestJobSchema = z.object({
	version: z.literal(1),
	workspaceId: z.string().min(1),
	batchId: z.string().min(1),
})

export const STOJobSchema = z.object({
	version: z.literal(1),
	workspaceId: z.string().min(1),
})

export const OutboxTickJobSchema = z.object({ version: z.literal(1) })
export const ReconciliationJobSchema = z.object({ version: z.literal(1) })

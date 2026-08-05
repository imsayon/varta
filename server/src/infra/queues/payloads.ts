import { z } from "zod"

export const SendEmailJobSchema = z.object({
	notificationId: z.string().min(1),
	deliveryId: z.string().min(1),
	workspaceId: z.string().min(1),
	subscriberEmail: z.string().email(),
	renderedContent: z.object({
		subject: z.string(),
		html: z.string(),
		textBody: z.string().optional(),
	}),
	providerConfig: z.object({
		providerName: z.string(),
		apiKey: z.string(),
		fromAddress: z.string(),
	}),
	delayMs: z.number().optional(),
})

export const SendInAppJobSchema = z.object({
	notificationId: z.string().min(1),
	deliveryId: z.string().min(1),
	workspaceId: z.string().min(1),
	subscriberId: z.string().min(1),
	content: z.record(z.string(), z.unknown()),
	delayMs: z.number().optional(),
})

export const SendWebhookJobSchema = z.object({
	notificationId: z.string().min(1),
	deliveryId: z.string().min(1),
	workspaceId: z.string().min(1),
	url: z.string().url(),
	eventType: z.string(),
	payload: z.record(z.string(), z.unknown()),
	signingSecret: z.string(),
	delayMs: z.number().optional(),
})

export const DigestJobSchema = z.object({
	workspaceId: z.string().min(1),
	batchId: z.string().min(1),
})

export const STOJobSchema = z.object({
	workspaceId: z.string().min(1),
})

import { z } from "zod"
import {
	NotificationPriority,
	NotificationChannel,
} from "./notification.types.ts"

export const triggerNotificationSchema = z.object({
	templateId: z.string().min(1),
	subscriberExternalId: z.string().min(1),
	payload: z.record(z.string(), z.unknown()).default({}),
	options: z
		.object({
			smartTiming: z.boolean().default(false),
			channels: z.array(z.enum(NotificationChannel)).optional(),
			scheduledAt: z.iso.datetime().optional(),
			priority: z
				.enum(NotificationPriority)
				.default(NotificationPriority.NORMAL),
		})
		.optional(),
})

export type TriggerNotificationRequest = z.infer<
	typeof triggerNotificationSchema
>

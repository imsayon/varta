export enum NotificationChannel {
	EMAIL = "EMAIL",
	IN_APP = "IN_APP",
	WEBHOOK = "WEBHOOK",
}

export enum NotificationPriority {
	LOW = "LOW",
	NORMAL = "NORMAL",
	HIGH = "HIGH",
}

export type NotificationPayload = Record<string, unknown>
